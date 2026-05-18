import { cn } from '@/lib/utils';
import type { MetricsToggles } from '@/types/evaluation';
import { Zap } from 'lucide-react';

export type MetricsPickerTaskType = 'summarization' | 'classification';

interface ToggleableMetric {
  key: keyof MetricsToggles;
  label: string;
  description: string;
  task?: MetricsPickerTaskType;
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
        task: 'summarization',
        taskBadge: 'Summarization',
      },
      {
        key: 'rouge',
        label: 'ROUGE',
        description: 'Recall-oriented n-gram overlap.',
        task: 'summarization',
        taskBadge: 'Summarization',
      },
      {
        key: 'meteor',
        label: 'METEOR',
        description: 'Stem-aware overlap, more lenient than BLEU.',
        task: 'summarization',
        taskBadge: 'Summarization',
      },
      {
        key: 'levenshtein',
        label: 'Levenshtein similarity',
        description: 'Character-level edit-distance similarity.',
        task: 'summarization',
        taskBadge: 'Summarization',
      },
      {
        key: 'bertscore',
        label: 'BERTScore',
        description:
          'Embedding-based semantic similarity. Loads a transformer model once per run.',
        task: 'summarization',
        taskBadge: 'Summarization',
      },
      {
        key: 'classification_accuracy',
        label: 'Accuracy',
        description: 'Fraction of predictions that match the reference label.',
        task: 'classification',
        taskBadge: 'Classification',
      },
      {
        key: 'precision_macro',
        label: 'Precision (macro)',
        description: 'Per-class precision averaged across labels.',
        task: 'classification',
        taskBadge: 'Classification',
      },
      {
        key: 'recall_macro',
        label: 'Recall (macro)',
        description: 'Per-class recall averaged across labels.',
        task: 'classification',
        taskBadge: 'Classification',
      },
      {
        key: 'f1_macro',
        label: 'F1 (macro)',
        description: 'Harmonic mean of precision and recall, unweighted.',
        task: 'classification',
        taskBadge: 'Classification',
      },
      {
        key: 'f1_weighted',
        label: 'F1 (weighted)',
        description: 'F1 weighted by class support.',
        task: 'classification',
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

interface MetricsPickerProps {
  metrics: MetricsToggles;
  onChange: (metrics: MetricsToggles) => void;
  taskType?: MetricsPickerTaskType;
}

export function MetricsPicker({
  metrics,
  onChange,
  taskType,
}: MetricsPickerProps) {
  const visibleGroups = METRIC_GROUPS.map((group) => ({
    ...group,
    metrics: taskType
      ? group.metrics.filter((m) => !m.task || m.task === taskType)
      : group.metrics,
  })).filter((g) => g.metrics.length > 0);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">
          Pick the metrics to compute
        </h2>
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        Latency and cost are always computed regardless of choice of accuracy metrics.
      </p>

      <div className="space-y-4">
        {visibleGroups.map((group) => {
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
                      onChange(setGroupSelection(metrics, group, true))
                    }
                    className="text-primary hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(setGroupSelection(metrics, group, false))
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
                          <p className="text-sm font-medium">{metric.label}</p>
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
                          onChange({
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
  );
}
