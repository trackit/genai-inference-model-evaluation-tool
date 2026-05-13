"""Single source of truth for metric keys and config helpers used by the
evaluation engine.

Keep `METRIC_KEYS` in sync with the TypeScript counterpart at
`backend/src/models/Evaluation.ts` (and the frontend at
`frontend/src/types/evaluation.ts`). The shape stored in DynamoDB is just a
JSON object keyed by these names with boolean values.
"""
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
    """Return whether `key` should be computed.

    Missing keys default to True so legacy jobs (and partial configs) keep the
    pre-toggle behaviour of computing every metric.
    """
    if selected is None:
        return True
    return bool(selected.get(key, True))


def normalize_metrics_config(
    stored: Optional[Mapping[str, object]],
) -> Dict[str, bool]:
    """Coerce a stored metrics blob into a complete `{key: bool}` mapping.

    Unknown keys in `stored` are dropped; missing keys default to True.
    """
    source: Mapping[str, object] = stored or {}
    return {key: bool(source.get(key, True)) for key in METRIC_KEYS}
