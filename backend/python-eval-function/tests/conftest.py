import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
TESTS = ROOT / "tests"

for path in (SRC, ROOT, TESTS):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)


@pytest.fixture
def sample_pricing_file(tmp_path):
    pricing = {
        "test-model-v1": {"input_per_1k": 0.001, "output_per_1k": 0.002},
        "cheap-model-v1": {"input_per_1k": 0.0001, "output_per_1k": 0.0002},
    }
    pricing_path = tmp_path / "pricing.json"
    pricing_path.write_text(json.dumps(pricing), encoding="utf-8")
    return str(pricing_path)
