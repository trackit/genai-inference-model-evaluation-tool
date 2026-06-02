from typing import Dict, Mapping, Optional

METRIC_KEYS: tuple[str, ...] = (
    # Algorithmic — summarization
    'bleu',
    'rouge',
    'meteor',
    'levenshtein',
    'bertscore',
    # Algorithmic — classification
    'classification_accuracy',
    'precision_macro',
    'recall_macro',
    'f1_macro',
    'f1_weighted',
    # LLM-as-judge
    'geval_reasoning',
    'geval_faithfulness',
)


def is_metric_enabled(
    selected: Optional[Mapping[str, bool]],
    key: str,
) -> bool:
    if selected is None:
        return False
    return bool(selected.get(key, False))


def normalize_metrics_config(
    stored: Optional[Mapping[str, object]],
) -> Dict[str, bool]:
    source: Mapping[str, object] = stored or {}
    return {key: bool(source.get(key, False)) for key in METRIC_KEYS}
