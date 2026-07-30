from model_recommender import ModelRecommender, NormalizedMetrics

from factories import ModelResultMother


class TestModelRecommender:
  def setup_method(self):
    self.recommender = ModelRecommender()

  def test_returns_empty_recommendation_when_no_models(self):
    recommendation, scores = self.recommender.recommend([], {"accuracy": 1.0})

    assert recommendation.model_identifier == ""
    assert recommendation.weighted_score == 0.0
    assert recommendation.reasoning == "No models were evaluated"
    assert scores == {}

  def test_returns_single_model_with_score_one(self):
    model = ModelResultMother.basic(identifier="only-model")

    recommendation, scores = self.recommender.recommend(
      [model], {"accuracy": 0.5, "latency": 0.5}
    )

    assert recommendation.model_identifier == "only-model"
    assert recommendation.weighted_score == 1.0
    assert scores == {"only-model": 1.0}

  def test_recommends_higher_accuracy_model_when_accuracy_weighted(self):
    models = [
      ModelResultMother.basic(identifier="accurate", default_weight=0.9, total_usd=0.05),
      ModelResultMother.basic(identifier="cheap", default_weight=0.4, total_usd=0.01),
    ]
    weights = {"accuracy": 1.0, "latency": 0.0, "cost": 0.0}

    recommendation, scores = self.recommender.recommend(models, weights)

    assert recommendation.model_identifier == "accurate"
    assert scores["accurate"] > scores["cheap"]

  def test_normalize_direct_handles_zero_max(self):
    normalized = self.recommender._normalize_direct([0.0, 0.0])

    assert normalized == [1.0, 1.0]

  def test_normalize_inverse_prefers_lower_cost(self):
    normalized = self.recommender._normalize_inverse([0.01, 0.05])

    assert normalized[0] == 1.0
    assert normalized[1] == 0.2

  def test_calculate_weighted_score_ignores_zero_weights(self):
    normalized = NormalizedMetrics(accuracy=0.8, latency=0.5, cost=0.2)
    weights = {"accuracy": 1.0, "latency": 0.0, "cost": 0.0}

    score = self.recommender.calculate_weighted_score(normalized, weights)

    assert score == 0.8

  def test_generate_reasoning_mentions_dominant_priority(self):
    models = [
      ModelResultMother.basic(identifier="a", default_weight=0.9),
      ModelResultMother.basic(identifier="b", default_weight=0.5),
    ]
    normalized = self.recommender.normalize_metrics(models)
    best = next(n for n in normalized if n.accuracy == 1.0)

    reasoning = self.recommender._generate_reasoning(
      "a", best, {"accuracy": 0.8, "latency": 0.1, "cost": 0.1}, models
    )

    assert "high accuracy" in reasoning
    assert "prioritizing accuracy" in reasoning
