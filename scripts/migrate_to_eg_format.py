#!/usr/bin/env python3
"""
Migrate dataset metadata to canonical field names/formats defined by eg.yaml.

Inputs:
  - assets root containing info/consolidated_datasets.json, or
  - a consolidated_datasets.json file directly.

Outputs:
  - <output>/info/consolidated_datasets.json
  - <output>/info/data_index.json
  - <output>/dataset_info/<dataset_key>.yaml
  - copy-through of info/exclude.json, info/robot_aliases.json, thumbnails/, videos/
"""

from __future__ import annotations

import argparse
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


INFO_FILES_TO_COPY = ("exclude.json", "robot_aliases.json")


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, tuple, set)):
        return len(value) == 0
    if isinstance(value, dict):
        return len(value) == 0
    return False


def _load_yaml(path: Path) -> dict[str, Any]:
    if yaml is None:
        raise RuntimeError("pyyaml is required. Install with: pip install pyyaml")
    with open(path, encoding="utf-8") as f:
        obj = yaml.safe_load(f)
    if not isinstance(obj, dict):
        raise ValueError(f"YAML root is not dict: {path}")
    return obj


def _load_datasets(input_path: Path, log: logging.Logger) -> dict[str, dict[str, Any]]:
    if input_path.is_file():
        with open(input_path, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("Input JSON root must be an object (dataset_key -> object)")
        log.info("[LOAD] %s datasets from file %s", len(data), input_path)
        return {str(k): v for k, v in data.items() if isinstance(v, dict)}

    consolidated = input_path / "info" / "consolidated_datasets.json"
    if consolidated.is_file():
        with open(consolidated, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("consolidated_datasets.json root must be object")
        log.info("[LOAD] %s datasets from %s", len(data), consolidated)
        return {str(k): v for k, v in data.items() if isinstance(v, dict)}

    raise FileNotFoundError(
        f"Cannot find input datasets. Expected file JSON or {input_path}/info/consolidated_datasets.json"
    )


def _normalize_scene_type(value: Any) -> dict[str, Any]:
    levels = ["level1", "level2", "level3", "level4", "level5"]
    out = {k: None for k in levels}

    if isinstance(value, dict):
        for k in levels:
            v = value.get(k)
            if isinstance(v, str):
                v = v.strip()
                out[k] = v if v else None
            elif v is not None:
                out[k] = str(v)
        return out

    if isinstance(value, list):
        clean = [str(v).strip() for v in value if v is not None and str(v).strip()]
        for i, v in enumerate(clean[:5]):
            out[levels[i]] = v
        return out

    if isinstance(value, str) and value.strip():
        out["level1"] = value.strip()
    return out


def _normalize_sub_tasks(value: Any) -> list[str]:
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            if isinstance(item, dict):
                sub = item.get("subtask")
                if sub is not None and str(sub).strip():
                    out.append(str(sub).strip())
            elif item is not None and str(item).strip():
                out.append(str(item).strip())
        return out
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalize_atomic_actions(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v).strip() for v in value if v is not None and str(v).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalize_end_effector(value: Any) -> str:
    if isinstance(value, list):
        for v in value:
            if v is not None and str(v).strip():
                return str(v).strip()
        return ""
    if value is None:
        return ""
    return str(value).strip()


def _normalize_task_instruction(raw: dict[str, Any]) -> str:
    for key in ("task_instruction", "tasks", "task_descriptions"):
        v = raw.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, list) and v:
            first = v[0]
            if first is not None and str(first).strip():
                return str(first).strip()
    sub = raw.get("sub_tasks")
    if isinstance(sub, list) and sub:
        first = sub[0]
        if isinstance(first, dict):
            s = first.get("subtask")
            if s is not None and str(s).strip():
                return str(s).strip()
        elif first is not None and str(first).strip():
            return str(first).strip()
    return ""


def _normalize_frame_num(raw: dict[str, Any]) -> int | None:
    v = raw.get("frame_num")
    if v is not None and str(v).strip():
        try:
            return int(float(v))
        except (TypeError, ValueError):
            pass

    fr = raw.get("frame_range")
    if isinstance(fr, str) and fr.strip():
        s = fr.strip()
        if "-" in s:
            tail = s.split("-")[-1]
            try:
                return int(float(tail))
            except (TypeError, ValueError):
                pass
        else:
            try:
                return int(float(s))
            except (TypeError, ValueError):
                pass

    stats = raw.get("statistics")
    if isinstance(stats, dict):
        tf = stats.get("total_frames")
        if tf is not None and str(tf).strip():
            try:
                return int(float(tf))
            except (TypeError, ValueError):
                pass
    return None


def _first_nonempty(raw: dict[str, Any], names: list[str]) -> Any:
    for name in names:
        if name in raw and not _is_empty(raw.get(name)):
            return raw.get(name)
    return None


def _infer_robot_from_path(dataset_key: str, alias_keys: list[str]) -> str:
    for key in alias_keys:
        if dataset_key == key or dataset_key.startswith(f"{key}_"):
            return key
        # case-insensitive match
        if dataset_key.lower() == key.lower() or dataset_key.lower().startswith(f"{key.lower()}_"):
            return key
    # fallback heuristic: first token before underscore
    if "_" in dataset_key:
        return dataset_key.split("_")[0]
    return ""


def _build_output_object(
    dataset_key: str,
    raw: dict[str, Any],
    template: dict[str, Any],
    alias_keys: list[str],
) -> dict[str, Any]:
    out: dict[str, Any] = {}

    # 1) prefill with defaults from eg template
    for canonical, meta in template.items():
        default = meta.get("default") if isinstance(meta, dict) else None
        out[canonical] = default

    # 2) generic alias-aware filling
    for canonical, meta in template.items():
        if canonical in raw and not _is_empty(raw.get(canonical)):
            out[canonical] = raw.get(canonical)
            continue
        aliases = meta.get("alias") if isinstance(meta, dict) else None
        if isinstance(aliases, list):
            v = _first_nonempty(raw, aliases)
            if v is not None:
                out[canonical] = v

    # 3) canonical special handling
    out["dataset_name"] = raw.get("dataset_name") or dataset_key
    out["scene_type"] = _normalize_scene_type(out.get("scene_type"))
    out["task_instruction"] = _normalize_task_instruction(raw)
    out["sub_tasks"] = _normalize_sub_tasks(raw.get("sub_tasks"))
    out["atomic_actions"] = _normalize_atomic_actions(raw.get("atomic_actions"))
    out["end_effector_type"] = _normalize_end_effector(raw.get("end_effector_type"))

    robot_name = _first_nonempty(raw, ["robot_name", "device_model", "robot_type"])
    if isinstance(robot_name, list):
        robot_name = next((str(v).strip() for v in robot_name if v is not None and str(v).strip()), "")
    elif robot_name is not None:
        robot_name = str(robot_name).strip()
    else:
        robot_name = ""
    if not robot_name:
        robot_name = _infer_robot_from_path(dataset_key, alias_keys)
    out["robot_name"] = robot_name

    frame_num = _normalize_frame_num(raw)
    out["frame_num"] = frame_num if frame_num is not None else out.get("frame_num")

    dataset_size = _first_nonempty(raw, ["dataset_size"])
    if dataset_size is None and isinstance(raw.get("statistics"), dict):
        dataset_size = raw["statistics"].get("dataset_size")
    if dataset_size is not None:
        out["dataset_size"] = dataset_size

    if isinstance(raw.get("statistics"), dict):
        out["statistics"] = raw["statistics"]

    # camera aliases and sensor list inference
    came_info = _first_nonempty(raw, ["came_info", "camera_info", "cameras"])
    if came_info is not None:
        out["came_info"] = came_info
    if _is_empty(out.get("sensor_list")) and isinstance(out.get("came_info"), dict):
        out["sensor_list"] = list(out["came_info"].keys())

    # data structure alias
    ds = _first_nonempty(raw, ["data_structure", "structure"])
    if ds is not None:
        out["data_structure"] = ds

    # contact detail alias
    cd = _first_nonempty(raw, ["contact_detail", "contact_email", "dataset_email"])
    if cd is not None:
        out["contact_detail"] = cd

    # keep raw object for traceability
    out["raw"] = raw
    return out


def _load_robot_alias_keys(input_root: Path) -> list[str]:
    candidates = [
        input_root / "info" / "robot_aliases.json",
        input_root / "assets" / "info" / "robot_aliases.json",
    ]
    for path in candidates:
        if path.is_file():
            with open(path, encoding="utf-8") as f:
                obj = json.load(f)
            if isinstance(obj, dict):
                keys = [str(k) for k in obj.keys() if str(k).strip()]
                keys.sort(key=len, reverse=True)
                return keys
    return []


def _write_outputs(
    migrated: dict[str, dict[str, Any]],
    output_root: Path,
    dry_run: bool,
    log: logging.Logger,
) -> None:
    if dry_run:
        log.info("[WRITE] Dry run: would write %s datasets to %s", len(migrated), output_root)
        return

    if yaml is None:
        raise RuntimeError("pyyaml is required. Install with: pip install pyyaml")

    info_dir = output_root / "info"
    dataset_info_dir = output_root / "dataset_info"
    info_dir.mkdir(parents=True, exist_ok=True)
    dataset_info_dir.mkdir(parents=True, exist_ok=True)

    with open(info_dir / "consolidated_datasets.json", "w", encoding="utf-8") as f:
        json.dump(migrated, f, indent=2, ensure_ascii=False)

    keys = sorted(migrated.keys())
    with open(info_dir / "data_index.json", "w", encoding="utf-8") as f:
        json.dump({"datasets": keys, "count": len(keys)}, f, indent=2, ensure_ascii=False)

    for key, obj in migrated.items():
        out_yaml = dataset_info_dir / f"{key}.yaml"
        out_yaml.parent.mkdir(parents=True, exist_ok=True)
        with open(out_yaml, "w", encoding="utf-8") as f:
            yaml.dump(obj, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    log.info("[WRITE] Wrote consolidated + index + %s YAML files", len(migrated))


def _copy_optional(input_root: Path, output_root: Path, dry_run: bool, log: logging.Logger) -> None:
    in_info = input_root / "info"
    out_info = output_root / "info"
    out_info.mkdir(parents=True, exist_ok=True)

    for name in INFO_FILES_TO_COPY:
        src = in_info / name
        if src.is_file():
            dst = out_info / name
            if dry_run:
                log.info("[COPY] Would copy %s -> %s", src, dst)
            else:
                shutil.copy2(src, dst)

    for sub in ("thumbnails", "videos"):
        src_dir = input_root / sub
        if not src_dir.is_dir():
            continue
        dst_dir = output_root / sub
        if dry_run:
            log.info("[COPY] Would copy dir %s -> %s", src_dir, dst_dir)
            continue
        dst_dir.mkdir(parents=True, exist_ok=True)
        for p in src_dir.rglob("*"):
            if p.is_file():
                rel = p.relative_to(src_dir)
                out = dst_dir / rel
                out.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, out)


def run(input_path: Path, output_root: Path, template_path: Path, dry_run: bool, log: logging.Logger) -> None:
    template = _load_yaml(template_path)
    datasets = _load_datasets(input_path, log)
    input_root = input_path if input_path.is_dir() else input_path.parent
    alias_keys = _load_robot_alias_keys(input_root)

    migrated: dict[str, dict[str, Any]] = {}
    for key, raw in datasets.items():
        migrated[key] = _build_output_object(key, raw, template, alias_keys)

    missing_robot = sum(1 for _, v in migrated.items() if _is_empty(v.get("robot_name")))
    log.info("[MIGRATE] total=%s missing_robot_name=%s", len(migrated), missing_robot)

    _write_outputs(migrated, output_root, dry_run, log)
    _copy_optional(input_root, output_root, dry_run, log)
    log.info("[DONE] Migration complete.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate metadata to eg.yaml canonical format")
    parser.add_argument("--input", type=Path, required=True, help="Assets root or consolidated_datasets.json")
    parser.add_argument("--output", type=Path, required=True, help="Output directory")
    parser.add_argument(
        "--template",
        type=Path,
        default=Path("eg.yaml"),
        help="Path to canonical template file (default: eg.yaml)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Do not write files")
    parser.add_argument("--log-dir", type=Path, default=Path("logs"), help="Log directory")
    parser.add_argument("--log-level", choices=("DEBUG", "INFO", "WARNING", "ERROR"), default="INFO")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"[ERROR] input not found: {args.input}")
        return 1
    if not args.template.exists():
        print(f"[ERROR] template not found: {args.template}")
        return 1

    args.log_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone(timedelta(hours=8))).strftime("%Y%m%d%H%M%S")
    log_path = args.log_dir / f"migrate_to_eg_format_{ts}.log"
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s | %(levelname)-8s | [%(name)s] | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.FileHandler(log_path, encoding="utf-8"), logging.StreamHandler(sys.stdout)],
    )
    log = logging.getLogger("migrate_to_eg_format")

    try:
        run(args.input, args.output, args.template, args.dry_run, log)
        return 0
    except Exception as exc:
        log.exception("[ERROR] %s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
