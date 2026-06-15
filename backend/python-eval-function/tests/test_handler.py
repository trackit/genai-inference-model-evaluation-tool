import importlib.util
import json
from pathlib import Path


def _load_root_handler():
  handler_path = Path(__file__).resolve().parent.parent / "handler.py"
  spec = importlib.util.spec_from_file_location("root_handler", handler_path)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


class TestRootHandler:
  def test_returns_ok_status_payload(self):
    root_handler_module = _load_root_handler()
    response = root_handler_module.handler({}, None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["status"] == "ok"
    assert body["message"] == "Evaluation handler ready"
