import { Button } from '@/components/ui/button';
import { useDatasetPreview, useEditGroundTruth } from '@/hooks/useEvaluation';
import type { DatasetSample } from '@/types/evaluation';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
} from 'lucide-react';
import { Fragment, useState } from 'react';

interface DatasetConfirmProps {
  datasetId: string;
  sampleCount: number;
  onConfirm: () => void;
  onBack: () => void;
  isStarting?: boolean;
}

function groundTruthValue(sample: DatasetSample): string {
  if (sample.summary !== undefined) return sample.summary;
  if (sample.class_label !== undefined) return sample.class_label;
  return '';
}

function isEditableSummary(sample: DatasetSample): boolean {
  return sample.sample_id !== undefined && sample.summary !== undefined;
}

function isEditableClass(sample: DatasetSample): boolean {
  return sample.sample_id !== undefined && sample.class_label !== undefined;
}

function buildDirtyEdits(
  samples: DatasetSample[],
  drafts: Record<string, string>,
): Record<string, string> {
  const edits: Record<string, string> = {};
  for (const sample of samples) {
    if (!sample.sample_id) continue;
    if (!isEditableSummary(sample) && !isEditableClass(sample)) continue;

    const draft = drafts[sample.sample_id] ?? groundTruthValue(sample);
    const original = groundTruthValue(sample);
    if (draft.trim() !== original.trim()) {
      edits[sample.sample_id] = draft.trim();
    }
  }
  return edits;
}

export function DatasetConfirm({
  datasetId,
  sampleCount,
  onConfirm,
  onBack,
  isStarting = false,
}: DatasetConfirmProps) {
  const { data, isLoading, isError, error, refetch } =
    useDatasetPreview(datasetId);
  const editGroundTruthMutation = useEditGroundTruth(datasetId);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const samples = data?.samples ?? [];
  const dirtyEdits = buildDirtyEdits(samples, drafts);
  const hasPendingEdits = Object.keys(dirtyEdits).length > 0;
  const hasSummary = samples.some((s) => s.summary !== undefined);
  const hasClass = samples.some((s) => s.class_label !== undefined);
  const hasEditableSamples = samples.some(
    (sample) => isEditableSummary(sample) || isEditableClass(sample),
  );

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const colSpan = 2 + (hasSummary ? 1 : 0) + (hasClass ? 1 : 0);

  const handleDraftChange = (sampleId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [sampleId]: value }));
  };

  const handleSaveAll = async () => {
    if (!hasPendingEdits) return;

    await editGroundTruthMutation.mutateAsync({ edits: dirtyEdits });
    setDrafts((prev) => {
      const next = { ...prev };
      for (const sampleId of Object.keys(dirtyEdits)) {
        delete next[sampleId];
      }
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Confirm Dataset</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Review the first {samples.length > 0 ? samples.length : '…'} of{' '}
        {sampleCount} samples.
        {hasEditableSamples
          ? ' Edit any inaccurate ground truth and save before starting evaluation, or go back to re-upload.'
          : ' Confirm to start evaluation, or go back to re-upload.'}
      </p>

      {isLoading && (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading preview…</span>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error.message}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-10" />
                <col
                  className={hasSummary && hasClass ? 'w-[32%]' : 'w-[38%]'}
                />
                {hasSummary && (
                  <col
                    className={
                      hasClass
                        ? 'w-[48%]'
                        : hasEditableSamples
                          ? 'w-[54%]'
                          : 'w-[50%]'
                    }
                  />
                )}
                {hasClass && <col className="w-[40%]" />}
                <col className="w-10" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-8">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Document
                  </th>
                  {hasSummary && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Summary
                    </th>
                  )}
                  {hasClass && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Class
                    </th>
                  )}
                  <th className="px-2 py-3 w-8" aria-label="Expand row" />
                </tr>
              </thead>
              <tbody>
                {samples.map((sample, i) => {
                  const isExpanded = expandedRows.has(i);
                  const editableSummary = isEditableSummary(sample);
                  const editableClass = isEditableClass(sample);
                  const sampleId = sample.sample_id;
                  const draft =
                    sampleId !== undefined
                      ? (drafts[sampleId] ?? groundTruthValue(sample))
                      : '';
                  const isDirty =
                    sampleId !== undefined && sampleId in dirtyEdits;

                  return (
                    <Fragment key={sampleId ?? i}>
                      <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3 text-foreground/80 align-top">
                          <span
                            className={
                              isExpanded
                                ? 'line-clamp-5 whitespace-pre-wrap break-words'
                                : 'line-clamp-2'
                            }
                          >
                            {sample.document}
                          </span>
                        </td>
                        {hasSummary && (
                          <td className="px-4 py-3 text-foreground/80 align-top">
                            {editableSummary && sampleId ? (
                              <GroundTruthEditor
                                multiline
                                value={draft}
                                onChange={(value) =>
                                  handleDraftChange(sampleId, value)
                                }
                                isDirty={isDirty}
                              />
                            ) : (
                              <span
                                className={
                                  isExpanded
                                    ? 'line-clamp-5 whitespace-pre-wrap break-words'
                                    : 'line-clamp-2'
                                }
                              >
                                {sample.summary ?? (
                                  <span className="text-muted-foreground italic">
                                    —
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                        )}
                        {hasClass && (
                          <td className="px-4 py-3 align-top">
                            {editableClass && sampleId ? (
                              <GroundTruthEditor
                                value={draft}
                                onChange={(value) =>
                                  handleDraftChange(sampleId, value)
                                }
                                isDirty={isDirty}
                              />
                            ) : sample.class_label !== undefined ? (
                              <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-mono">
                                {sample.class_label}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">
                                —
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-2 py-3 align-top">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleRow(i)}
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} row ${i + 1}`}
                              className="rounded p-1 text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            {isExpanded && (
                              <button
                                type="button"
                                onClick={() =>
                                  downloadSampleJsonl(sample, drafts, i)
                                }
                                aria-label={`Download sample ${i + 1} as JSONL`}
                                className="rounded p-1 text-muted-foreground hover:text-foreground"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-b border-border bg-muted/10">
                          <td
                            colSpan={colSpan + 1}
                            className="px-4 py-3 space-y-3 text-sm"
                          >
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                Document
                              </p>
                              <p className="line-clamp-5 whitespace-pre-wrap break-words">
                                {sample.document}
                              </p>
                            </div>
                            {hasSummary &&
                              sample.summary &&
                              !editableSummary && (
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                    Summary
                                  </p>
                                  <p className="line-clamp-5 whitespace-pre-wrap break-words">
                                    {sample.summary}
                                  </p>
                                </div>
                              )}
                            {hasClass &&
                              sample.class_label !== undefined &&
                              !editableClass && (
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                    Class
                                  </p>
                                  <p className="font-mono">
                                    {sample.class_label}
                                  </p>
                                </div>
                              )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editGroundTruthMutation.isError && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {editGroundTruthMutation.error.message}
        </p>
      )}

      {hasEditableSamples && hasPendingEdits && (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={() => void handleSaveAll()}
            disabled={editGroundTruthMutation.isPending}
            className="gap-2"
          >
            {editGroundTruthMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving changes…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      )}

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!data || isStarting || editGroundTruthMutation.isPending}
          className="gap-2"
          size="lg"
        >
          {isStarting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Starting…
            </>
          ) : (
            'Start Evaluation'
          )}
        </Button>
      </div>
    </motion.div>
  );
}

function downloadSampleJsonl(
  sample: DatasetSample,
  drafts: Record<string, string>,
  index: number,
): void {
  const line = `${JSON.stringify(sampleToJsonlObject(sample, drafts))}\n`;
  const blob = new Blob([line], { type: 'application/jsonl' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `sample-${index + 1}.jsonl`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sampleToJsonlObject(
  sample: DatasetSample,
  drafts: Record<string, string>,
): Record<string, string> {
  const row: Record<string, string> = { document: sample.document };
  if (sample.sample_id) row.sample_id = sample.sample_id;

  if (sample.summary !== undefined) {
    row.summary =
      sample.sample_id !== undefined
        ? (drafts[sample.sample_id] ?? sample.summary)
        : sample.summary;
  }

  if (sample.class_label !== undefined) {
    row.class =
      sample.sample_id !== undefined
        ? (drafts[sample.sample_id] ?? sample.class_label)
        : sample.class_label;
  }

  return row;
}

function GroundTruthEditor({
  value,
  onChange,
  isDirty,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  isDirty: boolean;
  multiline?: boolean;
}) {
  const fieldClassName =
    'w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return multiline ? (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={4}
      className={`${fieldClassName} resize-y min-h-[6rem] ${isDirty ? 'border-primary' : ''}`}
    />
  ) : (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${fieldClassName} ${isDirty ? 'border-primary' : ''}`}
    />
  );
}
