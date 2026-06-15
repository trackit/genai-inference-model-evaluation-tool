import json
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from dynamodb_service import DynamoDBService


class TestDynamoDBService:
  def setup_method(self):
    self.mock_table = MagicMock()
    mock_resource = MagicMock()
    mock_resource.Table.return_value = self.mock_table
    patcher = patch("dynamodb_service.boto3.resource", return_value=mock_resource)
    patcher.start()
    self.addCleanup = patcher.stop
    self.service = DynamoDBService(table_name="evaluation-jobs")

  def teardown_method(self):
    self.addCleanup()

  def test_load_job_returns_parsed_config(self):
    self.mock_table.get_item.return_value = {
      "Item": {
        "evaluation_id": "eval-1",
        "dataset_id": "dataset-1",
        "models": json.dumps([{"identifier": "amazon-nova-lite"}]),
        "weights": json.dumps({"accuracy": 1.0}),
        "metrics": json.dumps({"bleu": True, "rouge": False}),
        "status": "pending",
      }
    }

    job = self.service.load_job("eval-1")

    assert job["evaluation_id"] == "eval-1"
    assert job["dataset_id"] == "dataset-1"
    assert job["models"] == [{"identifier": "amazon-nova-lite"}]
    assert job["weights"] == {"accuracy": 1.0}
    assert job["metrics"]["bleu"] is True
    assert job["metrics"]["rouge"] is False
    assert job["metrics"]["meteor"] is False

  def test_load_job_raises_when_item_missing(self):
    self.mock_table.get_item.return_value = {}
    with pytest.raises(ValueError, match="Evaluation job not found"):
      self.service.load_job("missing")

  def test_load_job_defaults_metrics_when_invalid_json(self):
    self.mock_table.get_item.return_value = {
      "Item": {
        "evaluation_id": "eval-1",
        "dataset_id": "dataset-1",
        "models": "[]",
        "weights": "{}",
        "metrics": "not-json",
      }
    }

    job = self.service.load_job("eval-1")

    assert all(value is False for value in job["metrics"].values())

  def test_update_progress_sets_status_and_progress(self):
    self.service.update_progress("eval-1", status="running", progress=42.5)

    kwargs = self.mock_table.update_item.call_args.kwargs
    assert kwargs["Key"] == {"evaluation_id": "eval-1"}
    assert kwargs["ExpressionAttributeValues"][":status"] == "running"
    assert kwargs["ExpressionAttributeValues"][":progress"] == Decimal("42.5")

  def test_update_progress_includes_completed_fields(self):
    model_results = [{"identifier": "model-a"}]
    recommendation = {
      "model_identifier": "model-a",
      "weighted_score": 0.9,
      "reasoning": "best",
    }

    self.service.update_progress(
      "eval-1",
      status="completed",
      progress=100.0,
      model_results=model_results,
      recommendation=recommendation,
    )

    values = self.mock_table.update_item.call_args.kwargs["ExpressionAttributeValues"]
    assert json.loads(values[":model_results"]) == model_results
    assert json.loads(values[":recommendation"]) == recommendation
    assert ":completed_at" in values

  def test_update_progress_includes_timeout_results(self):
    model_results = [{"identifier": "model-a"}]

    self.service.update_progress(
      "eval-1",
      status="timeout",
      progress=0.0,
      error_message="timed out",
      model_results=model_results,
    )

    values = self.mock_table.update_item.call_args.kwargs["ExpressionAttributeValues"]
    assert json.loads(values[":model_results"]) == model_results
    assert "recommendation" in self.mock_table.update_item.call_args.kwargs[
      "UpdateExpression"
    ]

  def test_update_progress_raises_client_errors(self):
    self.mock_table.update_item.side_effect = ClientError(
      {"Error": {"Code": "ConditionalCheckFailedException", "Message": "fail"}},
      "UpdateItem",
    )

    with pytest.raises(ClientError):
      self.service.update_progress("eval-1", status="failed", progress=0.0)
