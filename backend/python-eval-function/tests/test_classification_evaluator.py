from classification_evaluator import (
  ClassificationEvaluator,
  normalize_prediction,
)


class TestNormalizePrediction:
  def test_matches_case_insensitive_exact_label(self):
    assert normalize_prediction("SPORTS", ["sports", "tech"]) == "sports"

  def test_matches_single_substring_label(self):
    assert normalize_prediction("The answer is tech.", ["sports", "tech"]) == "tech"

  def test_returns_cleaned_prediction_when_no_match(self):
    assert normalize_prediction("  unknown  ", ["sports", "tech"]) == "unknown"


class TestClassificationEvaluator:
  def setup_method(self):
    self.evaluator = ClassificationEvaluator()

  def test_returns_none_when_predictions_or_references_missing(self):
    assert self.evaluator.calculate_classification_metrics([], ["a"]) is None
    assert self.evaluator.calculate_classification_metrics(["a"], []) is None

  def test_returns_none_when_all_references_are_empty(self):
    result = self.evaluator.calculate_classification_metrics(
      ["sports"], ["", None]
    )
    assert result is None

  def test_calculates_perfect_classification_scores(self):
    selected = {
      "classification_accuracy": True,
      "precision_macro": True,
      "recall_macro": True,
      "f1_macro": True,
      "f1_weighted": True,
    }

    result = self.evaluator.calculate_classification_metrics(
      ["sports", "tech", "sports"],
      ["sports", "tech", "sports"],
      valid_classes=["sports", "tech"],
      selected=selected,
    )

    assert result.accuracy == 1.0
    assert result.precision_macro == 1.0
    assert result.recall_macro == 1.0
    assert result.f1_macro == 1.0
    assert result.f1_weighted == 1.0

  def test_normalizes_predictions_before_scoring(self):
    selected = {"classification_accuracy": True}

    result = self.evaluator.calculate_classification_metrics(
      ["SPORTS", "tech category"],
      ["sports", "tech"],
      valid_classes=["sports", "tech"],
      selected=selected,
    )

    assert result.accuracy == 1.0

  def test_only_computes_selected_metrics(self):
    selected = {"classification_accuracy": True, "f1_weighted": True}

    result = self.evaluator.calculate_classification_metrics(
      ["sports", "tech"],
      ["sports", "tech"],
      valid_classes=["sports", "tech"],
      selected=selected,
    )

    assert result.accuracy == 1.0
    assert result.f1_weighted == 1.0
    assert result.precision_macro is None
    assert result.recall_macro is None
