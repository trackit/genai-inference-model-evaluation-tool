import json

from cost_calculator import CostCalculator


class TestCostCalculator:
  def test_calculate_cost_uses_pricing_per_1k_tokens(self, sample_pricing_file):
    calculator = CostCalculator(pricing_file=sample_pricing_file)

    cost = calculator.calculate_cost("test-model-v1", input_tokens=1000, output_tokens=500)

    assert cost == 0.002

  def test_calculate_cost_returns_zero_for_unknown_model(self, sample_pricing_file):
    calculator = CostCalculator(pricing_file=sample_pricing_file)

    assert calculator.calculate_cost("unknown-model", 100, 100) == 0.0

  def test_calculate_total_cost_returns_rounded_breakdown(self, sample_pricing_file):
    calculator = CostCalculator(pricing_file=sample_pricing_file)

    result = calculator.calculate_total_cost("test-model-v1", 2000, 1000)

    assert result == {
      "total_usd": 0.004,
      "input_tokens": 2000,
      "output_tokens": 1000,
    }

  def test_handles_missing_pricing_file_gracefully(self, tmp_path):
    calculator = CostCalculator(pricing_file=str(tmp_path / "missing.json"))

    assert calculator.pricing == {}
    assert calculator.calculate_cost("any-model", 10, 10) == 0.0

  def test_handles_invalid_pricing_json(self, tmp_path):
    bad_file = tmp_path / "bad.json"
    bad_file.write_text("not-json", encoding="utf-8")

    calculator = CostCalculator(pricing_file=str(bad_file))

    assert calculator.pricing == {}
