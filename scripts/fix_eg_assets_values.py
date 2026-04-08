#!/usr/bin/env python3
"""
Normalize values in eg-format assets folder:
1) end_effector_type -> *_finger_gripper
2) add/update frame_range with bucket labels (no exact counts)
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import yaml


FINGER_PATTERN = re.compile(r"^([a-z0-9]+)_finger_(hand|gripper)$", re.IGNORECASE)


def normalize_end_effector(value: Any) -> Any:
    def norm_one(v: Any) -> Any:
        if v is None:
            return v
        s = str(v).strip().lower()
        if s.endswith("_finger_hand"):
            return s.replace("_finger_hand", "_finger_gripper")
        m = FINGER_PATTERN.match(s)
        if m:
            return f"{m.group(1)}_finger_gripper"
        return s

    if isinstance(value, list):
        return [norm_one(v) for v in value]
    return norm_one(value)


def parse_frame_num(obj: dict[str, Any]) -> int | None:
    candidates = [
        obj.get("frame_num"),
        (obj.get("statistics") or {}).get("total_frames") if isinstance(obj.get("statistics"), dict) else None,
    ]
    raw = obj.get("raw")
    if isinstance(raw, dict):
        candidates.extend(
            [
                raw.get("frame_num"),
                (raw.get("statistics") or {}).get("total_frames") if isinstance(raw.get("statistics"), dict) else None,
                raw.get("frame_range"),
            ]
        )

    for c in candidates:
        if c is None:
            continue
        if isinstance(c, (int, float)):
            return int(c)
        s = str(c).strip()
        if not s:
            continue
        if "-" in s:
            s = s.split("-")[-1].strip()
        try:
            return int(float(s))
        except ValueError:
            continue
    return None


def frame_bucket(frame_num: int | None) -> str:
    if frame_num is None:
        return "unknown"
    if frame_num < 10_000:
        return "0-10K"
    if frame_num < 100_000:
        return "10K-100K"
    if frame_num < 1_000_000:
        return "100K-1M"
    if frame_num < 10_000_000:
        return "1M-10M"
    return "10M+"


def process_one(obj: dict[str, Any]) -> dict[str, Any]:
    obj["end_effector_type"] = normalize_end_effector(obj.get("end_effector_type"))
    fn = parse_frame_num(obj)
    obj["frame_range"] = frame_bucket(fn)
    return obj


def main() -> int:
    parser = argparse.ArgumentParser(description="Fix eg assets value normalization")
    parser.add_argument("--assets-root", type=Path, required=True)
    args = parser.parse_args()

    root = args.assets_root
    consolidated = root / "info" / "consolidated_datasets.json"
    dataset_info = root / "dataset_info"
    if not consolidated.is_file() or not dataset_info.is_dir():
        raise FileNotFoundError("assets root must contain info/consolidated_datasets.json and dataset_info/")

    with open(consolidated, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("consolidated_datasets.json root must be object")

    for key, obj in data.items():
        if isinstance(obj, dict):
            data[key] = process_one(obj)

    with open(consolidated, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    for yaml_path in dataset_info.glob("*.yaml"):
        with open(yaml_path, encoding="utf-8") as f:
            obj = yaml.safe_load(f)
        if isinstance(obj, dict):
            obj = process_one(obj)
            with open(yaml_path, "w", encoding="utf-8") as f:
                yaml.dump(obj, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    print(f"Updated {len(data)} datasets in consolidated + dataset_info YAMLs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
