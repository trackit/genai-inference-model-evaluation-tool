from unittest.mock import patch

from accuracy_evaluator import AccuracyEvaluator


class TestAccuracyEvaluator:
  def setup_method(self):
    self.evaluator = AccuracyEvaluator()

  def test_returns_none_when_references_missing_or_empty(self):
    assert self.evaluator.calculate_accuracy_metrics(["pred"], None) is None
    assert self.evaluator.calculate_accuracy_metrics(["pred"], []) is None
    assert self.evaluator.calculate_accuracy_metrics(["pred"], ["", None]) is None

  def test_computes_only_selected_metrics(self):
    selected = {"bleu": True, "rouge": False, "levenshtein": True}

    result = self.evaluator.calculate_accuracy_metrics(
      ["the cat sat on the mat"],
      ["the cat is on the mat"],
      selected=selected,
    )

    assert result.bleu is not None
    assert result.rouge is None
    assert result.levenshtein is not None
    assert result.meteor is None
    assert result.bertscore is None

  def test_bleu_returns_higher_score_for_closer_predictions(self):
    close = self.evaluator._calculate_bleu(
      ["the cat sat on the mat"],
      ["the cat sat on the mat"],
    )
    far = self.evaluator._calculate_bleu(
      ["completely different words"],
      ["the cat sat on the mat"],
    )

    assert close > far

  def test_rouge_returns_perfect_score_for_identical_text(self):
    score = self.evaluator._calculate_rouge(
      ["exact match summary"],
      ["exact match summary"],
    )

    assert score == 1.0

  def test_levenshtein_returns_perfect_score_for_identical_text(self):
    score = self.evaluator._calculate_levenshtein(["abc"], ["abc"])

    assert score == 1.0

  def test_meteor_delegates_to_nltk(self):
    with patch(
      "accuracy_evaluator.AccuracyEvaluator._calculate_meteor",
      return_value=0.75,
    ) as mock_meteor:
      selected = {"meteor": True}
      result = self.evaluator.calculate_accuracy_metrics(
        ["prediction"], ["reference"], selected=selected
      )

    mock_meteor.assert_called_once()
    assert result.meteor == 0.75

  def test_bertscore_delegates_to_bert_score_library(self):
    with patch(
      "accuracy_evaluator.AccuracyEvaluator._calculate_bertscore",
      return_value=0.91,
    ) as mock_bert:
      selected = {"bertscore": True}
      result = self.evaluator.calculate_accuracy_metrics(
        ["prediction"], ["reference"], selected=selected
      )

    mock_bert.assert_called_once()
    assert result.bertscore == 0.91

  def test_returns_none_when_metric_calculation_raises(self):
    with patch.object(
      self.evaluator,
      "_calculate_bleu",
      side_effect=RuntimeError("boom"),
    ):
      result = self.evaluator.calculate_accuracy_metrics(
        ["pred"],
        ["ref"],
        selected={"bleu": True},
      )

    assert result is None
