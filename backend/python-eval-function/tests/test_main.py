import os
from unittest.mock import MagicMock, patch

import pytest

import main
from main import (
  TimeoutException,
  get_evaluation_id,
  get_timeout_minutes,
  timeout_handler,
)

from factories import DatasetMother, InvocationResultMother, JobConfigMother
from accuracy_evaluator import AccuracyMetrics
from model_recommender import Recommendation

class TestMainHelpers:
  def test_get_evaluation_id_reads_environment(self, monkeypatch):
    monkeypatch.setenv("EVALUATION_ID", "eval-123")
    assert get_evaluation_id() == "eval-123"

  def test_get_evaluation_id_raises_when_missing(self, monkeypatch):
    monkeypatch.delenv("EVALUATION_ID", raising=False)

    with pytest.raises(ValueError, match="EVALUATION_ID"):
      get_evaluation_id()

  def test_get_timeout_minutes_uses_default(self, monkeypatch):
    monkeypatch.delenv("EVALUATION_TIMEOUT_MINUTES", raising=False)

    assert get_timeout_minutes() == 30

  def test_get_timeout_minutes_parses_valid_value(self, monkeypatch):
    monkeypatch.setenv("EVALUATION_TIMEOUT_MINUTES", "15")

    assert get_timeout_minutes() == 15

  def test_timeout_handler_raises_timeout_exception(self):
    with pytest.raises(TimeoutException):
      timeout_handler(None, None)


class TestMainOrchestration:
  def setup_main_mocks(self, monkeypatch, job_config, dataset):
    monkeypatch.setenv("EVALUATION_ID", "eval-1")
    monkeypatch.setenv("DATASET_BUCKET", "bucket")

    mock_db = MagicMock()
    mock_db.load_job.return_value = job_config

    mock_loader = MagicMock()
    mock_loader.load_dataset.return_value = dataset

    invocation = InvocationResultMother.success(
      response_text="matched summary",
      model_id="us.amazon.nova-lite-v1:0",
    )
    mock_bedrock = MagicMock()
    mock_bedrock.evaluate_models.return_value = {
      "us.amazon.nova-lite-v1:0": [invocation]
    }

    patches = {
      "dynamodb_service.DynamoDBService": MagicMock(return_value=mock_db),
      "dataset_loader.DatasetLoader": MagicMock(return_value=mock_loader),
      "bedrock_client.BedrockClient": MagicMock(return_value=mock_bedrock),
      "accuracy_evaluator.AccuracyEvaluator": MagicMock(),
      "classification_evaluator.ClassificationEvaluator": MagicMock(),
      "geval_evaluator.GEvalEvaluator": MagicMock(),
      "cost_calculator.CostCalculator": MagicMock(),
      "model_recommender.ModelRecommender": MagicMock(),
    }

  def test_main_completes_summarization_job(self, monkeypatch):
    job_config = JobConfigMother.summarization()
    dataset = DatasetMother.summarization(
      documents=["doc"],
      summaries=["matched summary"],
    )

    monkeypatch.setenv("EVALUATION_ID", "eval-1")
    monkeypatch.setattr(main.signal, "alarm", lambda _seconds: None)

    mock_db = MagicMock()
    mock_db.load_job.return_value = job_config

    mock_loader = MagicMock()
    mock_loader.load_dataset.return_value = dataset

    invocation = InvocationResultMother.success(
      response_text="matched summary",
      model_id="us.amazon.nova-lite-v1:0",
    )
    mock_bedrock = MagicMock()
    mock_bedrock.evaluate_models.return_value = {
      "us.amazon.nova-lite-v1:0": [invocation]
    }

    mock_accuracy = MagicMock()
    mock_accuracy.calculate_accuracy_metrics.return_value = AccuracyMetrics(
      bleu=0.8,
      rouge=0.7,
      levenshtein=0.9,
    )

    mock_geval = MagicMock()
    mock_geval.enabled = False

    mock_cost = MagicMock()
    mock_cost.calculate_total_cost.return_value = {
      "total_usd": 0.01,
      "input_tokens": 10,
      "output_tokens": 20,
    }


    mock_recommender = MagicMock()
    mock_recommender.recommend.return_value = (
      Recommendation(
        model_identifier="us.amazon.nova-lite-v1:0",
        weighted_score=1.0,
        reasoning="Only model evaluated",
      ),
      {"us.amazon.nova-lite-v1:0": 1.0},
    )

    with patch("dynamodb_service.DynamoDBService", return_value=mock_db), patch(
      "dataset_loader.DatasetLoader", return_value=mock_loader
    ), patch("bedrock_client.BedrockClient", return_value=mock_bedrock), patch(
      "accuracy_evaluator.AccuracyEvaluator", return_value=mock_accuracy
    ), patch(
      "geval_evaluator.GEvalEvaluator", return_value=mock_geval
    ), patch(
      "cost_calculator.CostCalculator", return_value=mock_cost
    ), patch(
      "model_recommender.ModelRecommender", return_value=mock_recommender
    ):
      exit_code = main.main()

    assert exit_code == 0
    mock_db.update_progress.assert_any_call(
      evaluation_id="eval-1",
      status="running",
      progress=0.0,
      total_samples=1,
    )
    completed_call = mock_db.update_progress.call_args_list[-1].kwargs
    assert completed_call["status"] == "completed"
    assert completed_call["progress"] == 100.0
    assert completed_call["recommendation"]["model_identifier"] == (
      "us.amazon.nova-lite-v1:0"
    )

  def test_main_marks_job_failed_on_exception(self, monkeypatch):
    monkeypatch.setenv("EVALUATION_ID", "eval-1")
    monkeypatch.setattr(main.signal, "alarm", lambda _seconds: None)

    mock_db = MagicMock()
    mock_db.load_job.side_effect = RuntimeError("db down")

    with patch("dynamodb_service.DynamoDBService", return_value=mock_db):
      exit_code = main.main()

    assert exit_code == 1
    mock_db.update_progress.assert_called_with(
      evaluation_id="eval-1",
      status="failed",
      progress=0.0,
      error_message="db down",
    )

  def test_main_handles_timeout_with_partial_results(self, monkeypatch):
    monkeypatch.setenv("EVALUATION_ID", "eval-1")
    monkeypatch.setattr(main.signal, "alarm", lambda _seconds: None)

    mock_db = MagicMock()
    mock_db.load_job.return_value = JobConfigMother.summarization()

    mock_loader = MagicMock()
    mock_loader.load_dataset.return_value = DatasetMother.summarization()

    mock_bedrock = MagicMock()
    mock_bedrock.evaluate_models.side_effect = main.TimeoutException("timed out")

    with patch("dynamodb_service.DynamoDBService", return_value=mock_db), patch(
      "dataset_loader.DatasetLoader", return_value=mock_loader
    ), patch("bedrock_client.BedrockClient", return_value=mock_bedrock):
      exit_code = main.main()

    assert exit_code == 1
    timeout_call = mock_db.update_progress.call_args_list[-1].kwargs
    assert timeout_call["status"] == "timeout"
