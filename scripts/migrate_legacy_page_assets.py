#!/usr/bin/env python3
"""
Standalone script: migrate legacy page assets to page-standard (DATA-REQUIREMENTS section 6).

Copy this file anywhere; run with Python 3.8+. Requires only: pip install pyyaml

Reads: old assets root (info/consolidated_datasets.json or dataset_info/*.yaml) or a single
       consolidated_datasets.json file.
Writes: output_root/info/consolidated_datasets.json, info/data_index.json,
        output_root/dataset_info/<path>.yaml (all with section-6 field mapping).
        Also copies from input if present: info/exclude.json, info/robot_aliases.json,
        thumbnails/, and videos/.

Usage:
  python migrate_legacy_page_assets.py --input /path/to/old/assets --output /path/to/new/assets
  python migrate_legacy_page_assets.py --input /path/to/consolidated_datasets.json --output /path/to/out
  python migrate_legacy_page_assets.py --input /path/to/old --output /path/to/out --dry-run
"""

from __future__ import annotations

import json
import logging
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None

# ---------------------------------------------------------------------------
# Section 6 mapping: info.yaml (metadata schema) -> page-standard fields
# ---------------------------------------------------------------------------


def _scene_type_to_array(scene_type: Any) -> list[str]:
    """scene_type object { level1..level5 } -> list of non-empty strings."""
    if not isinstance(scene_type, dict):
        return []
    out = []
    for key in ("level1", "level2", "level3", "level4", "level5"):
        v = scene_type.get(key)
        if v is not None and isinstance(v, str) and v.strip():
            out.append(v.strip())
    return out


def _tasks_from_instruction(raw: dict[str, Any]) -> str:
    """task_instruction (str/list) or sub_tasks[0] -> tasks string."""
    task_instruction = raw.get("task_instruction")
    if task_instruction is not None:
        if isinstance(task_instruction, str) and task_instruction.strip():
            return task_instruction.strip()
        if isinstance(task_instruction, list) and task_instruction:
            first = task_instruction[0]
            if isinstance(first, str) and first.strip():
                return first.strip()
            return "\n".join(str(x) for x in task_instruction if x is not None)
    sub_tasks = raw.get("sub_tasks")
    if isinstance(sub_tasks, list) and sub_tasks:
        first = sub_tasks[0]
        if isinstance(first, str) and first.strip():
            return first.strip()
    return ""


def _frame_range_display(raw: dict[str, Any]) -> str:
    """frame_num / statistics.total_frames -> display string e.g. 0-N."""
    frame_num = raw.get("frame_num")
    stats = raw.get("statistics")
    total_frames = stats.get("total_frames") if isinstance(stats, dict) else None
    if total_frames is not None and total_frames != "":
        try:
            return f"0-{int(total_frames)}"
        except (TypeError, ValueError):
            pass
    if frame_num is not None and frame_num != "":
        return str(frame_num)
    return ""


def _dataset_size_value(raw: dict[str, Any]) -> Any:
    """Top-level dataset_size else statistics.dataset_size else ""."""
    v = raw.get("dataset_size")
    if v is not None and v != "":
        return v
    stats = raw.get("statistics")
    if isinstance(stats, dict):
        v = stats.get("dataset_size")
        if v is not None and v != "":
            return v
    return ""


def _robot_type_value(raw: dict[str, Any]) -> str:
    """robot_name else device_model else ""."""
    for key in ("robot_name", "device_model"):
        v = raw.get(key)
        if v is not None and isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _cameras_value(raw: dict[str, Any]) -> Any:
    """came_info or camera_info."""
    return raw.get("came_info") if raw.get("came_info") is not None else raw.get("camera_info")


def _data_schema_value(raw: dict[str, Any]) -> Any:
    """data_structure or structure."""
    return raw.get("data_structure") if raw.get("data_structure") is not None else raw.get("structure")


def _structure_value(raw: dict[str, Any]) -> Any:
    """structure or data_structure."""
    return raw.get("structure") if raw.get("structure") is not None else raw.get("data_structure")


_OPTIONAL_SAME_NAME = (
    "dataset_uuid", "language", "task_categories", "sub_tasks", "annotations",
    "authors", "homepage", "paper", "repository", "license", "tags",
    "citation_bibtex", "depth_enabled",
)


def map_to_page_object(raw: dict[str, Any], path_key: str) -> dict[str, Any]:
    """Convert one legacy dataset object to page-standard (section 6)."""
    scene_raw = raw.get("scene_type")
    stats_raw = raw.get("statistics")
    objects_raw = raw.get("objects")

    out = {
        "path": path_key,
        "dataset_name": (raw.get("dataset_name") or path_key or "").strip() or path_key,
        "robot_type": _robot_type_value(raw),
        "end_effector_type": raw.get("end_effector_type"),
        "scene_type": _scene_type_to_array(scene_raw) if scene_raw is not None else [],
        "atomic_actions": raw.get("atomic_actions") if raw.get("atomic_actions") is not None else [],
        "tasks": _tasks_from_instruction(raw),
        "objects": objects_raw if isinstance(objects_raw, list) else [],
        "operation_platform_height": raw.get("operation_platform_height"),
        "frame_range": _frame_range_display(raw),
        "dataset_size": _dataset_size_value(raw),
        "statistics": stats_raw if isinstance(stats_raw, dict) else None,
    }
    for key in _OPTIONAL_SAME_NAME:
        if key in raw and raw[key] is not None:
            out[key] = raw[key]
    if _cameras_value(raw) is not None:
        out["cameras"] = _cameras_value(raw)
    if _data_schema_value(raw) is not None:
        out["data_schema"] = _data_schema_value(raw)
    if _structure_value(raw) is not None:
        out["structure"] = _structure_value(raw)
    return out


# ---------------------------------------------------------------------------
# Load / Write / Migration
# ---------------------------------------------------------------------------


def load_legacy_datasets(input_path: Path, log: logging.Logger) -> dict[str, dict]:
    """Load path -> raw object from consolidated JSON or dataset_info/*.yaml."""
    if input_path.is_file():
        with open(input_path, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("JSON root must be an object (path -> dataset).")
        log.info("[LOAD] %s datasets from %s", len(data), input_path)
        return dict(data)

    consolidated = input_path / "info" / "consolidated_datasets.json"
    if consolidated.exists():
        with open(consolidated, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("Consolidated JSON root must be an object.")
        log.info("[LOAD] %s datasets from %s", len(data), consolidated)
        return dict(data)

    dataset_info_dir = input_path / "dataset_info"
    if not dataset_info_dir.is_dir():
        raise FileNotFoundError(
            "No info/consolidated_datasets.json or dataset_info/ under %s" % input_path
        )
    if yaml is None:
        raise RuntimeError("YAML input requires: pip install pyyaml")
    yaml_files = list(dataset_info_dir.glob("*.yaml")) + list(dataset_info_dir.glob("*.yml"))
    if not yaml_files:
        raise FileNotFoundError("No YAML files in %s" % dataset_info_dir)

    out = {}
    for yf in yaml_files:
        try:
            with open(yf, encoding="utf-8") as f:
                obj = yaml.safe_load(f)
            if isinstance(obj, dict):
                out[yf.stem] = obj
        except Exception as e:
            log.warning("[LOAD] Skip %s: %s", yf.name, e)
    log.info("[LOAD] %s datasets from %s", len(out), dataset_info_dir)
    return out


# Optional info/ files to copy from input to output when present (no transformation).
INFO_FILES_TO_COPY = ("exclude.json", "robot_aliases.json")


def copy_info_files(input_root: Path, output_root: Path, log: logging.Logger, dry_run: bool) -> None:
    """Copy optional info/*.json files from input to output if they exist."""
    input_info = input_root / "info"
    if not input_info.is_dir():
        return
    out_info = output_root / "info"
    out_info.mkdir(parents=True, exist_ok=True)
    for name in INFO_FILES_TO_COPY:
        src = input_info / name
        if not src.is_file():
            continue
        dst = out_info / name
        if dry_run:
            log.info("[COPY] Would copy info/%s -> %s", name, dst)
        else:
            shutil.copy2(src, dst)
            log.info("[COPY] info/%s -> %s", name, dst)


def copy_thumbnails_and_videos(
    input_root: Path, output_root: Path, log: logging.Logger, dry_run: bool
) -> None:
    """Copy thumbnails/ and videos/ directories from input to output if they exist."""
    for subdir in ("thumbnails", "videos"):
        src_dir = input_root / subdir
        if not src_dir.is_dir():
            continue
        dst_dir = output_root / subdir
        if dry_run:
            count = sum(1 for _ in src_dir.rglob("*") if _.is_file())
            log.info("[COPY] Would copy %s/ (%s files) -> %s", subdir, count, dst_dir)
        else:
            dst_dir.mkdir(parents=True, exist_ok=True)
            copied = 0
            for f in src_dir.rglob("*"):
                if f.is_file():
                    rel = f.relative_to(src_dir)
                    d = dst_dir / rel
                    d.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(f, d)
                    copied += 1
            log.info("[COPY] %s/ -> %s (%s files)", subdir, dst_dir, copied)


def write_migrated(migrated: dict[str, dict], output_root: Path, log: logging.Logger, dry_run: bool) -> None:
    """Write consolidated_datasets.json, data_index.json, dataset_info/<path>.yaml."""
    if dry_run:
        log.info("[WRITE] Dry run: would write %s datasets under %s", len(migrated), output_root)
        return
    info_dir = output_root / "info"
    dataset_info_dir = output_root / "dataset_info"
    info_dir.mkdir(parents=True, exist_ok=True)
    dataset_info_dir.mkdir(parents=True, exist_ok=True)

    with open(info_dir / "consolidated_datasets.json", "w", encoding="utf-8") as f:
        json.dump(migrated, f, indent=2, ensure_ascii=False)
    paths_sorted = sorted(migrated.keys())
    with open(info_dir / "data_index.json", "w", encoding="utf-8") as f:
        json.dump({"datasets": paths_sorted, "count": len(paths_sorted)}, f, indent=2, ensure_ascii=False)

    if yaml is None:
        raise RuntimeError("YAML output requires: pip install pyyaml")
    for path_key, obj in migrated.items():
        yaml_path = dataset_info_dir / ("%s.yaml" % path_key)
        yaml_path.parent.mkdir(parents=True, exist_ok=True)
        with open(yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(obj, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    log.info("[WRITE] %s consolidated, data_index, %s YAMLs under %s", len(migrated), len(migrated), output_root)


def run(input_path: Path, output_root: Path, log: logging.Logger, dry_run: bool) -> None:
    """Load legacy -> map -> write; then copy optional info files."""
    raw = load_legacy_datasets(input_path, log)
    if not raw:
        log.warning("[MIGRATE] No datasets.")
        return
    migrated = {k: map_to_page_object(v, k) for k, v in raw.items()}
    log.info("[MIGRATE] Mapped %s datasets.", len(migrated))
    write_migrated(migrated, output_root, log, dry_run)
    input_root = input_path if input_path.is_dir() else input_path.parent
    copy_info_files(input_root, output_root, log, dry_run)
    copy_thumbnails_and_videos(input_root, output_root, log, dry_run)
    log.info("[MIGRATE] Done.")


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="Migrate legacy page assets to section-6 standard.")
    parser.add_argument("--input", type=Path, required=True, help="Old assets root or consolidated_datasets.json")
    parser.add_argument("--output", type=Path, required=True, help="Output directory (info/ + dataset_info/)")
    parser.add_argument("--dry-run", action="store_true", help="Do not write files.")
    parser.add_argument("--log-dir", type=Path, default=Path("logs"), help="Log directory (default: logs)")
    parser.add_argument("--log-level", choices=("DEBUG", "INFO", "WARNING", "ERROR"), default="INFO")
    args = parser.parse_args()

    args.log_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone(timedelta(hours=8))).strftime("%Y%m%d%H%M%S")
    log_file = args.log_dir / ("migrate_legacy_page_assets_%s.log" % ts)
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(asctime)s | %(levelname)-8s | [%(name)s] | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    log = logging.getLogger("migrate_legacy_page_assets")

    log.info("[CLI] input=%s output=%s dry_run=%s", args.input, args.output, args.dry_run)
    if not args.input.exists():
        log.error("[CLI] Input does not exist: %s", args.input)
        return 1
    try:
        run(args.input, args.output, log, args.dry_run)
        return 0
    except Exception as e:
        log.exception("[CLI] %s", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
