from metrics import METRIC_KEYS, is_metric_enabled, normalize_metrics_config


class TestIsMetricEnabled:
  def test_returns_false_when_selected_is_none(self):
    assert is_metric_enabled(None, "bleu") is False

  def test_returns_true_when_metric_is_enabled(self):
    selected = {"bleu": True, "rouge": False}
    assert is_metric_enabled(selected, "bleu") is True

  def test_returns_false_when_metric_is_missing_or_false(self):
    selected = {"bleu": False}
    assert is_metric_enabled(selected, "bleu") is False
    assert is_metric_enabled(selected, "rouge") is False


class TestNormalizeMetricsConfig:
  def test_normalizes_none_to_all_false(self):
    result = normalize_metrics_config(None)
    assert set(result.keys()) == set(METRIC_KEYS)
    assert all(value is False for value in result.values())

  def test_preserves_enabled_flags_and_defaults_missing_to_false(self):
    stored = {"bleu": True, "geval_reasoning": 1}
    result = normalize_metrics_config(stored)

    assert result["bleu"] is True
    assert result["geval_reasoning"] is True
    assert result["rouge"] is False
    assert result["f1_weighted"] is False
