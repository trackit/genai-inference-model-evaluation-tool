import logging
from typing import Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ClassificationMetrics:
    accuracy: Optional[float] = None
    precision_macro: Optional[float] = None
    recall_macro: Optional[float] = None
    f1_macro: Optional[float] = None
    f1_weighted: Optional[float] = None


def normalize_prediction(prediction: str, valid_classes: List[str]) -> str:
    cleaned = prediction.strip()

    for valid_class in valid_classes:
        if cleaned.lower() == valid_class.lower():
            return valid_class

    matches = [valid_class for valid_class in valid_classes if valid_class.lower() in cleaned.lower()]
    if len(matches) == 1:
        return matches[0]

    return cleaned


class ClassificationEvaluator:

    def __init__(self):
        logger.info("Initialized ClassificationEvaluator")

    def calculate_classification_metrics(
        self,
        predictions: List[str],
        references: List[str],
        valid_classes: Optional[List[str]] = None,
    ) -> Optional[ClassificationMetrics]:
        if not references or not predictions:
            logger.info("No references or predictions, skipping classification metrics")
            return None

        if all(ref is None or ref == "" for ref in references):
            logger.info("All references are empty, skipping classification metrics")
            return None

        if valid_classes is None:
            valid_classes = list(set(references))

        normalized_preds = [
            normalize_prediction(pred, valid_classes) for pred in predictions
        ]

        logger.info(
            f"Calculating classification metrics for {len(normalized_preds)} predictions "
            f"across {len(valid_classes)} classes"
        )

        try:
            from sklearn.metrics import (
                accuracy_score,
                precision_recall_fscore_support,
            )

            all_labels = list(set(valid_classes + references + normalized_preds))

            acc = accuracy_score(references, normalized_preds)

            precision, recall, f1, _ = precision_recall_fscore_support(
                references,
                normalized_preds,
                labels=all_labels,
                average="macro",
                zero_division=0,
            )

            _, _, f1_w, _ = precision_recall_fscore_support(
                references,
                normalized_preds,
                labels=all_labels,
                average="weighted",
                zero_division=0,
            )

            metrics = ClassificationMetrics(
                accuracy=round(acc, 4),
                precision_macro=round(precision, 4),
                recall_macro=round(recall, 4),
                f1_macro=round(f1, 4),
                f1_weighted=round(f1_w, 4),
            )

            logger.info(
                f"Classification metrics - Accuracy={metrics.accuracy}, "
                f"Precision={metrics.precision_macro}, Recall={metrics.recall_macro}, "
                f"F1_macro={metrics.f1_macro}, F1_weighted={metrics.f1_weighted}"
            )

            return metrics

        except Exception as e:
            logger.error(f"Error calculating classification metrics: {e}", exc_info=True)
            return None
