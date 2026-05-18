import {
  METRIC_GROUPS,
  type MetricKey,
  type MetricsToggles,
  type TaskType,
  METRIC_KEYS,
} from '@/types/evaluation';

export function buildDefaultsForTask(
  taskType: TaskType | undefined,
): MetricsToggles {
  const base = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, false]),
  ) as MetricsToggles;

  if (!taskType) return base;

  for (const group of METRIC_GROUPS) {
    for (const m of group.metrics) {
      if (!m.task || m.task === taskType) {
        base[m.key] = true;
      }
    }
  }

  return base;
}

export function pickEnabledMetrics(
  toggles: MetricsToggles,
): Partial<Record<MetricKey, true>> {
  return Object.fromEntries(
    Object.entries(toggles).filter(([, v]) => v),
  ) as Partial<Record<MetricKey, true>>;
}
