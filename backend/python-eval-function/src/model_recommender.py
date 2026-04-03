import logging
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class NormalizedMetrics:
    accuracy: Optional[float] = None
    latency: float = 0.0
    cost: float = 0.0


@dataclass
class Recommendation:
    model_identifier: str
    weighted_score: float
    reasoning: str


class ModelRecommender:
    
    def __init__(self):
        logger.info("Initialized ModelRecommender")
    
    def recommend(
        self,
        model_results: List[Dict],
        weights: Dict[str, float]
    ) -> Tuple[Recommendation, Dict[str, float]]:
        """Return the best-model recommendation and per-model weighted scores.

        Normalization and scoring are performed once and shared between both outputs.
        """
        empty_scores = {m['identifier']: 0.0 for m in model_results}

        if not model_results:
            logger.warning("No model results provided, returning empty recommendation")
            return Recommendation(
                model_identifier="",
                weighted_score=0.0,
                reasoning="No models were evaluated"
            ), {}
        
        if len(model_results) == 1:
            model = model_results[0]
            logger.info(f"Only one model evaluated: {model['identifier']}")
            return Recommendation(
                model_identifier=model['identifier'],
                weighted_score=1.0,
                reasoning="Only model evaluated"
            ), {model['identifier']: 1.0}
        
        normalized = self.normalize_metrics(model_results)
        
        weighted_scores = []
        for i, model in enumerate(model_results):
            score = self.calculate_weighted_score(normalized[i], weights)
            weighted_scores.append((model['identifier'], score, normalized[i]))
            logger.debug(f"Model {model['identifier']}: weighted_score={score:.4f}")
        
        scores_by_model = {mid: round(s, 4) for mid, s, _ in weighted_scores}
        
        best_model_id, best_score, best_normalized = max(weighted_scores, key=lambda x: x[1])
        
        reasoning = self._generate_reasoning(
            best_model_id,
            best_normalized,
            weights,
            model_results
        )
        
        logger.info(f"Recommended model: {best_model_id} (score={best_score:.4f})")
        
        return Recommendation(
            model_identifier=best_model_id,
            weighted_score=round(best_score, 4),
            reasoning=reasoning
        ), scores_by_model

    def normalize_metrics(self, model_results: List[Dict]) -> List[NormalizedMetrics]:
        logger.info(f"Normalizing metrics for {len(model_results)} models")
        
        accuracy_scores = []
        latency_scores = []
        cost_scores = []
        
        ACCURACY_WEIGHTS = {
            "geval_reasoning":    0.25,
            "geval_faithfulness": 0.25,
            "bertscore":          0.30,
            "bleu":               0.05,
            "rouge":              0.05,
            "meteor":             0.05,
            "levenshtein":        0.05,
        }

        for model in model_results:
            metrics = model['metrics']
            
            acc = None
            if metrics.get('accuracy'):
                acc_dict = metrics['accuracy']
                weighted_sum = 0.0
                weight_sum = 0.0
                for metric_name, weight in ACCURACY_WEIGHTS.items():
                    val = acc_dict.get(metric_name)
                    if val is not None:
                        weighted_sum += val * weight
                        weight_sum += weight
                acc = (weighted_sum / weight_sum) if weight_sum > 0 else None
            
            accuracy_scores.append(acc)
            
            latency = metrics['latency']['tokens_per_second']
            latency_scores.append(latency)
            
            cost = metrics['cost']['total_usd']
            cost_scores.append(cost)
        
        normalized_accuracy = self._normalize_direct(accuracy_scores)
        normalized_latency = self._normalize_direct(latency_scores)
        normalized_cost = self._normalize_inverse(cost_scores)
        
        normalized = []
        for i in range(len(model_results)):
            normalized.append(NormalizedMetrics(
                accuracy=normalized_accuracy[i],
                latency=normalized_latency[i],
                cost=normalized_cost[i]
            ))
        
        logger.info("Metric normalization complete")
        return normalized
    
    def _normalize_direct(self, values: List[Optional[float]]) -> List[Optional[float]]:
        valid_values = [v for v in values if v is not None]
        
        if not valid_values:
            return [None] * len(values)
        
        min_val = min(valid_values)
        max_val = max(valid_values)
        
        if min_val == max_val:
            return [1.0 if v is not None else None for v in values]
        
        normalized = []
        for v in values:
            if v is None:
                normalized.append(None)
            else:
                norm = (v - min_val) / (max_val - min_val)
                normalized.append(norm)
        
        return normalized
    
    def _normalize_inverse(self, values: List[float]) -> List[float]:
        if not values:
            return []
        
        min_val = min(values)
        max_val = max(values)
        
        if min_val == max_val:
            return [1.0] * len(values)
        
        normalized = []
        for v in values:
            norm = (max_val - v) / (max_val - min_val)
            normalized.append(norm)
        
        return normalized
    
    def calculate_weighted_score(
        self,
        normalized: NormalizedMetrics,
        weights: Dict[str, float]
    ) -> float:
        score = 0.0
        total_weight = 0.0
        
        w_accuracy = weights.get('accuracy', 0.0)
        if w_accuracy > 0 and normalized.accuracy is not None:
            score += normalized.accuracy * w_accuracy
            total_weight += w_accuracy
        
        w_latency = weights.get('latency', 0.0)
        if w_latency > 0:
            score += normalized.latency * w_latency
            total_weight += w_latency
        
        w_cost = weights.get('cost', 0.0)
        if w_cost > 0:
            score += normalized.cost * w_cost
            total_weight += w_cost
        
        if total_weight > 0:
            score = score / total_weight
        
        return score
    
    def _generate_reasoning(
        self,
        model_id: str,
        normalized: NormalizedMetrics,
        weights: Dict[str, float],
        model_results: List[Dict]
    ) -> str:
        strengths = []
        
        if normalized.accuracy is not None and normalized.accuracy > 0.7:
            if weights.get('accuracy', 0) > 0:
                strengths.append("high accuracy")
        
        if normalized.latency > 0.7:
            if weights.get('latency', 0) > 0:
                strengths.append("fast response time")
        
        if normalized.cost > 0.7:
            if weights.get('cost', 0) > 0:
                strengths.append("low cost")
        
        if strengths:
            strength_text = ", ".join(strengths)
            reasoning = f"Recommended for {strength_text} based on configured priorities"
        else:
            reasoning = "Best overall balance across all metrics"
        
        dominant_weight = max(weights.items(), key=lambda x: x[1])
        if dominant_weight[1] > 0.5:
            reasoning += f", prioritizing {dominant_weight[0]}"
        
        return reasoning
