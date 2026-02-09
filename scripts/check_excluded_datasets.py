#!/usr/bin/env python3
"""
Check how many datasets are included in assets but excluded
"""

import json
import urllib.request
import urllib.error
from typing import Set, Dict, Any

# Assets root URL
ASSETS_ROOT = "https://huggingface.co/datasets/RogersPyke/RoboCOIN_DataManager_assets/resolve/main"
INFO_PATH = f"{ASSETS_ROOT}/info"
CONSOLIDATED_DATASETS_URL = f"{INFO_PATH}/consolidated_datasets.json"
EXCLUDE_JSON_URL = f"{INFO_PATH}/exclude.json"
DATA_INDEX_URL = f"{INFO_PATH}/data_index.json"


def fetch_json(url: str) -> Any:
    """Fetch JSON data from URL"""
    try:
        print(f"Fetching: {url}")
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"[OK] Successfully fetched data")
            return data
    except urllib.error.HTTPError as e:
        print(f"[ERROR] HTTP error {e.code}: {url}")
        return None
    except urllib.error.URLError as e:
        print(f"[ERROR] URL error: {e.reason}")
        return None
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON parse error: {e}")
        return None
    except Exception as e:
        print(f"[ERROR] Unknown error: {e}")
        return None


def get_all_datasets_from_assets() -> Set[str]:
    """Get all dataset names from assets"""
    datasets = set()
    
    # Try consolidated_datasets.json first
    consolidated = fetch_json(CONSOLIDATED_DATASETS_URL)
    if consolidated and isinstance(consolidated, dict):
        print(f"Found {len(consolidated)} datasets from consolidated_datasets.json")
        datasets.update(consolidated.keys())
        return datasets
    
    # If consolidated_datasets.json doesn't exist, try data_index.json (YAML mode)
    data_index = fetch_json(DATA_INDEX_URL)
    if data_index:
        if isinstance(data_index, list):
            file_list = data_index
        elif isinstance(data_index, dict):
            file_list = list(data_index.keys())
        else:
            print("[ERROR] data_index.json format is incorrect")
            return datasets
        
        # Extract dataset names from filenames (remove .yml or .yaml suffix)
        for file in file_list:
            if isinstance(file, str):
                dataset_name = file.replace('.yml', '').replace('.yaml', '')
                datasets.add(dataset_name)
        
        print(f"Found {len(datasets)} datasets from data_index.json")
        return datasets
    
    print("[ERROR] Unable to get dataset list from assets")
    return datasets


def get_excluded_datasets() -> Set[str]:
    """Get list of excluded datasets"""
    excluded = fetch_json(EXCLUDE_JSON_URL)
    if excluded and isinstance(excluded, list):
        excluded_set = {name.strip() for name in excluded if isinstance(name, str)}
        print(f"Found {len(excluded_set)} excluded datasets from exclude.json")
        return excluded_set
    elif excluded is None:
        print("[WARNING] exclude.json does not exist or is not accessible (this may be normal)")
        return set()
    else:
        print("[WARNING] exclude.json format is incorrect (should be a string array)")
        return set()


def main():
    print("=" * 60)
    print("Check datasets included in assets but excluded")
    print("=" * 60)
    print()
    
    # Get all datasets from assets
    all_datasets = get_all_datasets_from_assets()
    print()
    
    # Get excluded datasets
    excluded_datasets = get_excluded_datasets()
    print()
    
    # Find datasets that are in assets but excluded
    excluded_in_assets = all_datasets.intersection(excluded_datasets)
    
    # Output results
    print("=" * 60)
    print("Results:")
    print("=" * 60)
    print(f"Total datasets in assets: {len(all_datasets)}")
    print(f"Datasets in exclude list: {len(excluded_datasets)}")
    print(f"Datasets in assets and excluded: {len(excluded_in_assets)}")
    print()
    
    if excluded_in_assets:
        print("Datasets in assets but excluded:")
        print("-" * 60)
        sorted_excluded = sorted(excluded_in_assets)
        for i, dataset in enumerate(sorted_excluded, 1):
            print(f"{i:4d}. {dataset}")
        print("-" * 60)
    else:
        print("[OK] No datasets are in assets but excluded")
    
    # Check if there are datasets in exclude list but not in assets
    excluded_not_in_assets = excluded_datasets - all_datasets
    if excluded_not_in_assets:
        print()
        print(f"[WARNING] {len(excluded_not_in_assets)} datasets in exclude list but not in assets:")
        print("-" * 60)
        sorted_not_in_assets = sorted(excluded_not_in_assets)
        for i, dataset in enumerate(sorted_not_in_assets, 1):
            print(f"{i:4d}. {dataset}")
        print("-" * 60)
    
    print()
    print("=" * 60)


if __name__ == "__main__":
    main()


