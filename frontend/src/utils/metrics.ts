import {
  METRIC_GROUPS,
  METRIC_KEYS,
  type MetricKey,
  type MetricsToggles,
  type TaskType,
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

export function hasAtLeastOneMetric(toggles: MetricsToggles): boolean {
  return Object.values(toggles).some(Boolean);
}

export function pickEnabledMetrics(
  toggles: MetricsToggles,
): Partial<Record<MetricKey, true>> {
  return Object.fromEntries(
    Object.entries(toggles).filter(([, v]) => v),
  ) as Partial<Record<MetricKey, true>>;
}
