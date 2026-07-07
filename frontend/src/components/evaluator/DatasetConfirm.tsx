import { Button } from '@/components/ui/button';
import { useDatasetPreview } from '@/hooks/useEvaluation';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
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

export function DatasetConfirm({
  datasetId,
  sampleCount,
  onConfirm,
  onBack,
  isStarting = false,
}: DatasetConfirmProps) {
  const { data, isLoading, isError, error, refetch } =
    useDatasetPreview(datasetId);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const samples = data?.samples ?? [];
  const hasSummary = samples.some((s) => s.summary !== undefined);
  const hasClass = samples.some((s) => s.class_label !== undefined);
  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  const colSpan = 2 + (hasSummary ? 1 : 0) + (hasClass ? 1 : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Confirm Dataset</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Review the first {samples.length > 0 ? samples.length : '…'} of{' '}
        {sampleCount} samples. Confirm to start evaluation, or go back to
        re-upload.
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
            <table className="w-full text-sm">
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
                  const canExpand =
                    sample.document.length > 80 ||
                    (sample.summary?.length ?? 0) > 80 ||
                    (sample.class_label?.length ?? 0) > 80;

                  return (
                    <Fragment key={i}>
                      <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3 text-foreground/80 max-w-xs">
                          <span
                            className={
                              isExpanded
                                ? 'whitespace-pre-wrap'
                                : 'line-clamp-2'
                            }
                          >
                            {sample.document}
                          </span>
                        </td>
                        {hasSummary && (
                          <td className="px-4 py-3 text-foreground/80 max-w-xs">
                            <span
                              className={
                                isExpanded
                                  ? 'whitespace-pre-wrap'
                                  : 'line-clamp-2'
                              }
                            >
                              {sample.summary ?? (
                                <span className="text-muted-foreground italic">
                                  —
                                </span>
                              )}
                            </span>
                          </td>
                        )}
                        {hasClass && (
                          <td className="px-4 py-3">
                            {sample.class_label !== undefined ? (
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
                        <td className="px-2 py-3">
                          {canExpand && (
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
                          )}
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
                              <p className="whitespace-pre-wrap break-words">
                                {sample.document}
                              </p>
                            </div>
                            {hasSummary && sample.summary && (
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                  Summary
                                </p>
                                <p className="whitespace-pre-wrap break-words">
                                  {sample.summary}
                                </p>
                              </div>
                            )}
                            {hasClass && sample.class_label !== undefined && (
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

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!data || isStarting}
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
