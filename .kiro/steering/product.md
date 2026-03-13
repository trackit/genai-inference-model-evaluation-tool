---
inclusion: always
---

# Product Overview

This is a Bedrock model evaluation tool that helps both technical and non-technical users compare and select the best LLM for their use case. Phase 1 focuses on model comparison across accuracy, latency, and cost. Phase 2 will add prompt optimization.

## Target Users

Both technical (ML engineers) and non-technical (product teams, stakeholders) users. A visual UI is required from day one.

## Deployment

Deployed as a full web UI application. Uses Amazon Bedrock exclusively for model inference.

---

# Phase 1 Scope

## Supported Models (defaults)

- Claude Sonnet
- Claude Opus
- Amazon Nova

Users can override and add any Bedrock model by providing a Bedrock model endpoint ID.

## Input Format

- CSV or JSONL file containing:
  - `prompt` (required)
  - `context` (optional)
  - `reference_output` (optional)

## Output

- Quantitative metrics per model (accuracy, latency, cost)
- Visual chart (radar/hexagon) comparing models
- Recommended model based on user-defined preferences

---

# Evaluation Metrics

## Accuracy

- Deterministic: BLEU, ROUGE, METEOR, Levenshtein
- Semantic: BERTScore, MoverScore
- LLM-as-judge: G-eval (via DeepEval) for reasoning and faithfulness

Both deterministic and LLM-as-judge should be used together to mitigate judge bias (e.g., Claude rating Claude outputs higher).

## Latency

- TPS (Tokens per second)
- TTFT (Time to First Token)
- Estimated total latency

## Cost

- Token-based cost estimation
- Per-model cost breakdown

---

# Data & Synthetic Generation

- Minimum dataset: 10–20 seed samples
- Typical dataset size: ~100 samples
- Synthetic data generation model: Claude Opus (default, not user-configurable in phase 1)
- Evaluations are on-demand, one-off runs

---

# User Experience

## Configuration

- Interactive wizard (no config files or CLI flags required)

## Progress & Feedback

- Progress bar during evaluation runs
- 30-minute max run time is acceptable for large datasets

## Output

- Summary view with recommended model
- Visual graph/chart of metrics per model (radar or hexagon chart)

---

# Constraints & Decisions

- No RAG support in phase 1 (deferred)
- No multi-turn conversation support
- No human-in-the-loop evaluation
- No multimodal support (text only)
- No custom or self-hosted model support
- No cost estimation preview before full run (deferred to later iteration)
- Inference limited to Amazon Bedrock only

---

# Phase 2 (Future)

- Prompt optimization via LLM-driven rewriting
- RAG evaluation as a separate component
- Potentially: configurable metric selection by user
