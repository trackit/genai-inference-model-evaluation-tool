import { cn } from '@/lib/utils';
import type { MetricGroup, MetricsToggles, TaskType } from '@/types/evaluation';
import { METRIC_GROUPS } from '@/types/evaluation';
import { Zap } from 'lucide-react';

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
  taskType?: TaskType;
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
