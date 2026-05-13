import { cn } from '@/lib/utils';
import type {
  MetricsToggles,
  MetricsWeights as Weights,
} from '@/types/evaluation';
import { motion } from 'framer-motion';
import { Info, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MetricsWeightsProps {
  value: Weights;
  onChange: (weights: Weights) => void;
  metrics: MetricsToggles;
  onMetricsChange: (metrics: MetricsToggles) => void;
}

interface ToggleableMetric {
  key: keyof MetricsToggles;
  label: string;
  description: string;
  /** Free-form badge text (e.g. "Summarization", "Classification"). */
  taskBadge?: string;
}

interface MetricGroup {
  id: string;
  title: string;
  subtitle: string;
  metrics: ToggleableMetric[];
}

const METRIC_GROUPS: MetricGroup[] = [
  {
    id: 'programmatic',
    title: 'Programmatic metrics',
    subtitle:
      'Deterministic scoring computed locally. Fast and cheap — only BERTScore has a noticeable load cost.',
    metrics: [
      {
        key: 'bleu',
        label: 'BLEU',
        description: 'N-gram overlap with the reference.',
        taskBadge: 'Summarization',
      },
      {
        key: 'rouge',
        label: 'ROUGE',
        description: 'Recall-oriented n-gram overlap.',
        taskBadge: 'Summarization',
      },
      {
        key: 'meteor',
        label: 'METEOR',
        description: 'Stem-aware overlap, more lenient than BLEU.',
        taskBadge: 'Summarization',
      },
      {
        key: 'levenshtein',
        label: 'Levenshtein similarity',
        description: 'Character-level edit-distance similarity.',
        taskBadge: 'Summarization',
      },
      {
        key: 'bertscore',
        label: 'BERTScore',
        description:
          'Embedding-based semantic similarity. Loads a transformer model once per run.',
        taskBadge: 'Summarization',
      },
      {
        key: 'classification_accuracy',
        label: 'Accuracy',
        description: 'Fraction of predictions that match the reference label.',
        taskBadge: 'Classification',
      },
      {
        key: 'precision_macro',
        label: 'Precision (macro)',
        description: 'Per-class precision averaged across labels.',
        taskBadge: 'Classification',
      },
      {
        key: 'recall_macro',
        label: 'Recall (macro)',
        description: 'Per-class recall averaged across labels.',
        taskBadge: 'Classification',
      },
      {
        key: 'f1_macro',
        label: 'F1 (macro)',
        description: 'Harmonic mean of precision and recall, unweighted.',
        taskBadge: 'Classification',
      },
      {
        key: 'f1_weighted',
        label: 'F1 (weighted)',
        description: 'F1 weighted by class support.',
        taskBadge: 'Classification',
      },
    ],
  },
  {
    id: 'llm-judge',
    title: 'LLM-as-judge metrics',
    subtitle:
      'Quality scores produced by an extra Bedrock model per sample. Most accurate, but the slowest and most expensive metrics.',
    metrics: [
      {
        key: 'geval_reasoning',
        label: 'G-Eval — Reasoning',
        description: 'How coherent and well-justified the output is.',
      },
      {
        key: 'geval_faithfulness',
        label: 'G-Eval — Faithfulness',
        description: 'Whether the output sticks to the input (no hallucination).',
      },
    ],
  },
];

function setGroupSelection(
  current: MetricsToggles,
  group: MetricGroup,
  value: boolean,
): MetricsToggles {
  const next = { ...current };
  for (const m of group.metrics) {
    next[m.key] = value;
  }
  return next;
}

function countSelected(metrics: MetricsToggles, group: MetricGroup): number {
  return group.metrics.reduce((n, m) => (metrics[m.key] ? n + 1 : n), 0);
}

const METRICS: { key: keyof Weights; label: string; description: string }[] = [
  {
    key: 'accuracy',
    label: 'Accuracy',
    description: 'Model correctness and quality of output',
  },
  { key: 'cost', label: 'Cost', description: 'Price per 1K tokens processed' },
  {
    key: 'latency',
    label: 'Latency',
    description: 'Response time in milliseconds',
  },
];

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function draftToNumber(s: string): number {
  if (s === '') return 0;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? 0 : clampPct(n);
}

function weightsFromDrafts(d: {
  accuracy: string;
  cost: string;
  latency: string;
}): Weights {
  return {
    accuracy: draftToNumber(d.accuracy),
    cost: draftToNumber(d.cost),
    latency: draftToNumber(d.latency),
  };
}

function normalizeDigitDraft(raw: string): string {
  if (raw === '') return '';
  if (!/^\d+$/.test(raw)) return '';
  const trimmed = raw.replace(/^0+/, '') || '0';
  return String(clampPct(Number.parseInt(trimmed, 10)));
}

function syncDraftFromValue(prev: string, num: number): string {
  if (prev === '' && num === 0) return '';
  return String(num);
}

export function MetricsWeights({
  value,
  onChange,
  metrics,
  onMetricsChange,
}: MetricsWeightsProps) {
  const [drafts, setDrafts] = useState({
    accuracy: String(value.accuracy),
    cost: String(value.cost),
    latency: String(value.latency),
  });

  useEffect(() => {
    queueMicrotask(() => {
      setDrafts((prev) => {
        const next = {
          accuracy: syncDraftFromValue(prev.accuracy, value.accuracy),
          cost: syncDraftFromValue(prev.cost, value.cost),
          latency: syncDraftFromValue(prev.latency, value.latency),
        };
        if (
          next.accuracy === prev.accuracy &&
          next.cost === prev.cost &&
          next.latency === prev.latency
        ) {
          return prev;
        }
        return next;
      });
    });
  }, [value.accuracy, value.cost, value.latency]);

  const updateDraft = (key: keyof Weights, raw: string) => {
    if (raw !== '' && !/^\d*$/.test(raw)) return;
    setDrafts((prev) => {
      const nextDrafts = { ...prev, [key]: normalizeDigitDraft(raw) };
      onChange(weightsFromDrafts(nextDrafts));
      return nextDrafts;
    });
  };

  const total =
    draftToNumber(drafts.accuracy) +
    draftToNumber(drafts.cost) +
    draftToNumber(drafts.latency);
  const isValid = total === 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">
        Set Metric Weights
      </h1>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        Enter how much each metric should count toward the overall score.
      </p>

      <div className="flex gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 mb-6">
        <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Why 100%? </span>
          These three numbers are the weights we use to blend accuracy, cost,
          and latency into one ranking. They must add up to exactly{' '}
          <span className="font-mono text-foreground">100%</span> so your
          priorities form a complete split.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {METRICS.map((metric) => (
          <div
            key={metric.key}
            className="rounded-xl border border-border bg-surface shadow-card p-4 space-y-2"
          >
            <div>
              <p className="text-sm font-semibold">{metric.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {metric.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={`${metric.label} weight percent`}
                value={drafts[metric.key]}
                onChange={(e) => updateDraft(metric.key, e.target.value)}
                className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-sm text-muted-foreground shrink-0">%</span>
            </div>
          </div>
        ))}
      </div>

      <div
        className={cn(
          'mt-4 flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm',
          isValid
            ? 'border-primary/25 bg-primary/5'
            : 'border-destructive/30 bg-destructive/5',
        )}
      >
        <span className="text-muted-foreground">Total</span>
        <span
          className={cn(
            'font-mono font-semibold tabular-nums',
            isValid ? 'text-primary' : 'text-destructive',
          )}
        >
          {total}%
        </span>
      </div>
      {!isValid && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          Total must equal exactly 100% before you can continue. Current total
          is {total}%.
        </p>
      )}

      <div className="mt-8">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">
            Pick the metrics to compute
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Latency and cost are always computed. Metrics that don't apply to
          your dataset (e.g. classification metrics on a summarization run)
          are skipped automatically.
        </p>

        <div className="space-y-4">
          {METRIC_GROUPS.map((group) => {
            const selectedCount = countSelected(metrics, group);
            const totalCount = group.metrics.length;
            return (
              <fieldset
                key={group.id}
                className="rounded-xl border border-border bg-surface p-3"
              >
                <legend className="px-1 text-sm font-semibold">
                  {group.title}
                </legend>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  {group.subtitle}
                </p>
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {selectedCount} / {totalCount} selected
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        onMetricsChange(setGroupSelection(metrics, group, true))
                      }
                      className="text-primary hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onMetricsChange(
                          setGroupSelection(metrics, group, false),
                        )
                      }
                      className="text-muted-foreground hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {group.metrics.map((metric) => {
                    const enabled = metrics[metric.key];
                    return (
                      <label
                        key={metric.key}
                        htmlFor={`metric-${metric.key}`}
                        className={cn(
                          'flex items-start justify-between gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors',
                          enabled
                            ? 'border-border bg-background'
                            : 'border-border bg-muted/30',
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">
                              {metric.label}
                            </p>
                            {metric.taskBadge && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {metric.taskBadge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {metric.description}
                          </p>
                        </div>
                        <input
                          id={`metric-${metric.key}`}
                          type="checkbox"
                          role="switch"
                          aria-checked={enabled}
                          checked={enabled}
                          onChange={(e) =>
                            onMetricsChange({
                              ...metrics,
                              [metric.key]: e.target.checked,
                            })
                          }
                          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
