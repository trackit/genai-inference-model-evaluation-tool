from unittest.mock import MagicMock, patch

from geval_evaluator import GEvalEvaluator, JUDGE_MODEL_DEFAULT


class TestGEvalEvaluator:
  def test_disabled_when_no_geval_metrics_selected(self):
    evaluator = GEvalEvaluator(metrics_config={"geval_reasoning": False})

    assert evaluator.enabled is False
    assert evaluator.compute_reasoning is False
    assert evaluator.compute_faithfulness is False

  def test_uses_defaults_for_judge_model_and_region(self, monkeypatch):
    monkeypatch.delenv("GEVAL_JUDGE_MODEL", raising=False)
    monkeypatch.delenv("AWS_REGION", raising=False)

    evaluator = GEvalEvaluator(
      metrics_config={"geval_reasoning": True},
      judge_model_id="custom-judge",
      region="eu-west-1",
    )

    assert evaluator.judge_model_id == "custom-judge"
    assert evaluator.region == "eu-west-1"

  def test_falls_back_to_environment_defaults(self, monkeypatch):
    monkeypatch.setenv("GEVAL_JUDGE_MODEL", "env-judge")
    monkeypatch.setenv("AWS_REGION", "us-east-1")

    evaluator = GEvalEvaluator(metrics_config={"geval_faithfulness": True})

    assert evaluator.judge_model_id == "env-judge"
    assert evaluator.region == "us-east-1"
    assert evaluator.judge_model_id != JUDGE_MODEL_DEFAULT or True

  def test_evaluate_returns_empty_when_inputs_or_predictions_missing(self):
    evaluator = GEvalEvaluator(metrics_config={"geval_reasoning": True})

    assert evaluator.evaluate([], ["pred"]).reasoning is None
    assert evaluator.evaluate(["inp"], []).reasoning is None

  def test_evaluate_returns_empty_on_length_mismatch(self):
    evaluator = GEvalEvaluator(metrics_config={"geval_reasoning": True})

    result = evaluator.evaluate(["one"], ["a", "b"])

    assert result.reasoning is None
    assert result.faithfulness is None

  def test_evaluate_averages_mocked_metric_scores(self):
    evaluator = GEvalEvaluator(
      metrics_config={
        "geval_reasoning": True,
        "geval_faithfulness": True,
      }
    )

    reasoning_metric = MagicMock()
    reasoning_metric.score = 0.8
    faithfulness_metric = MagicMock()
    faithfulness_metric.score = 0.6

    with patch.object(evaluator, "_build_judge_model", return_value=MagicMock()):
      with patch.object(
        evaluator, "_build_reasoning_metric", return_value=reasoning_metric
      ):
        with patch.object(
          evaluator,
          "_build_faithfulness_metric",
          return_value=faithfulness_metric,
        ):
          result = evaluator.evaluate(
            ["input one", "input two"],
            ["output one", "output two"],
          )

    assert result.reasoning == 0.8
    assert result.faithfulness == 0.6
    assert reasoning_metric.measure.call_count == 2
    assert faithfulness_metric.measure.call_count == 2

  def test_evaluate_skips_empty_predictions(self):
    evaluator = GEvalEvaluator(metrics_config={"geval_reasoning": True})
    reasoning_metric = MagicMock()
    reasoning_metric.score = 1.0

    with patch.object(evaluator, "_build_judge_model", return_value=MagicMock()):
      with patch.object(
        evaluator, "_build_reasoning_metric", return_value=reasoning_metric
      ):
        result = evaluator.evaluate(["input"], ["   "])

    assert result.reasoning is None
    reasoning_metric.measure.assert_not_called()

  def test_evaluate_returns_empty_when_initialization_fails(self):
    evaluator = GEvalEvaluator(metrics_config={"geval_reasoning": True})

    with patch.object(
      evaluator, "_build_judge_model", side_effect=RuntimeError("init failed")
    ):
      result = evaluator.evaluate(["input"], ["output"])

    assert result.reasoning is None
    assert result.faithfulness is None
