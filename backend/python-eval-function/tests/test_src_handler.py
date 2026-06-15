import json

from handler import handler as src_handler


class TestSrcHandler:
  def test_returns_ok_status_payload(self):
    response = src_handler({}, None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["status"] == "ok"
    assert body["message"] == "Evaluation handler ready"
