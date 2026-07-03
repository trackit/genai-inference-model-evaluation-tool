import { MetricsPicker } from '@/components/evaluator/MetricsPicker';
import { Button } from '@/components/ui/button';
import { useUploadDataset } from '@/hooks/useEvaluation';
import { cn } from '@/lib/utils';
import type {
  DatasetUploadData,
  MetricsToggles,
  TaskType,
} from '@/types/evaluation';
import { hasAtLeastOneMetric } from '@/utils/metrics';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  FileCheck,
  FileText,
  Loader2,
  Sparkles,
  Tag,
  Upload,
} from 'lucide-react';
import { useState } from 'react';

interface DatasetUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  onStartEvaluation: () => void;
  onUploadSuccess: (data: {
    dataset_id: string;
    taskType: TaskType | undefined;
  }) => void;
  isStarting?: boolean;
  metrics: MetricsToggles;
  onMetricsChange: (metrics: MetricsToggles) => void;
}

const TASK_TYPES: {
  id: TaskType;
  label: string;
  icon: React.ElementType;
  description: string;
  autoDetect: string;
  requiredColumns: string[];
  optionalColumns: string[];
  metrics: string[];
  csvExample: string;
  jsonlExample: string;
}[] = [
  {
    id: 'summarization',
    label: 'Summarization',
    icon: FileText,
    description:
      'Evaluate how well models summarize documents against reference summaries.',
    autoDetect:
      'Summarization is detected when your file includes both "document" and "summary" columns.',
    requiredColumns: ['document', 'summary'],
    optionalColumns: [],
    metrics: ['BLEU', 'ROUGE', 'METEOR', 'BERTScore', 'G-Eval'],
    csvExample:
      'document,summary\n"The European Space Agency announced...","ESA announced a new Mars mission."\n"Scientists have discovered...","A new exoplanet was found."',
    jsonlExample:
      '{"document": "The European Space Agency announced...", "summary": "ESA announced a new Mars mission."}\n{"document": "Scientists have discovered...", "summary": "A new exoplanet was found."}',
  },
  {
    id: 'classification',
    label: 'Classification',
    icon: Tag,
    description:
      'Evaluate text classification accuracy against ground-truth labels.',
    autoDetect:
      'Classification is detected when your file includes both "document" and "class" columns.',
    requiredColumns: ['document', 'class'],
    optionalColumns: [],
    metrics: [
      'Accuracy',
      'Precision (macro)',
      'Recall (macro)',
      'F1 (macro & weighted)',
    ],
    csvExample:
      'document,class\n"I absolutely loved this product!","positive"\n"Terrible experience, never again.","negative"\n"It was okay, nothing special.","neutral"',
    jsonlExample:
      '{"document": "I absolutely loved this product!", "class": "positive"}\n{"document": "Terrible experience, never again.", "class": "negative"}\n{"document": "It was okay, nothing special.", "class": "neutral"}',
  },
];

type FormatTab = 'csv' | 'jsonl';

function resolveDetectedTask(data: {
  has_summary: boolean;
  has_class: boolean;
}): TaskType | undefined {
  if (data.has_summary) return 'summarization';
  if (data.has_class) return 'classification';
  return undefined;
}

function getValidationError(files: File[]): string | null {
  const extensions = files.map((file) =>
    file.name.toLowerCase().split('.').pop(),
  );
  const isDataset = (extension?: string) =>
    extension === 'csv' || extension === 'jsonl';
  const isDocument = (extension?: string) =>
    extension === 'pdf' || extension === 'doc' || extension === 'docx';

  if (
    extensions.some(
      (extension) => !isDataset(extension) && !isDocument(extension),
    )
  ) {
    return 'Unsupported file type. Supported: CSV, JSONL, PDF, DOC, DOCX';
  }

  if (extensions.some(isDataset) && files.length > 1) {
    return 'CSV/JSONL datasets must be uploaded alone';
  }

  return null;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isStructuredFile(file: File): boolean {
  const extension = file.name.toLowerCase().split('.').pop();
  return extension === 'csv' || extension === 'jsonl';
}

function isStructuredUpload(files: File[]): boolean {
  return files.length === 1 && isStructuredFile(files[0]);
}

function detectedTaskFromUpload(
  data: DatasetUploadData | undefined,
): TaskType | undefined {
  if (!data || data.dataset_type !== 'structured') return undefined;
  return resolveDetectedTask(data);
}

function TaskTypeButtons({
  selected,
  onSelect,
}: {
  selected: TaskType;
  onSelect: (task: TaskType) => void;
}) {
  return (
    <div className="flex gap-2">
      {TASK_TYPES.map((task) => {
        const Icon = task.icon;
        const isActive = task.id === selected;
        return (
          <button
            key={task.id}
            type="button"
            onClick={() => onSelect(task.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
              isActive
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {task.label}
          </button>
        );
      })}
    </div>
  );
}

export function DatasetUpload({
  files,
  onChange,
  onStartEvaluation,
  onUploadSuccess,
  isStarting = false,
  metrics,
  onMetricsChange,
}: DatasetUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskType>('summarization');
  const [selectedDocumentTask, setSelectedDocumentTask] =
    useState<TaskType | null>(null);
  const [formatTab, setFormatTab] = useState<FormatTab>('csv');
  const uploadMutation = useUploadDataset();
  const validationError = getValidationError(files);
  const showStructuredGuidance =
    files.length === 0 || isStructuredUpload(files);
  const isDocumentUploadSuccess =
    uploadMutation.isSuccess &&
    uploadMutation.data?.dataset_type === 'documents';
  const metricsTaskType = isDocumentUploadSuccess
    ? (selectedDocumentTask ?? undefined)
    : detectedTaskFromUpload(uploadMutation.data);
  const canStartEvaluation =
    hasAtLeastOneMetric(metrics) &&
    (!isDocumentUploadSuccess || selectedDocumentTask !== null);

  const handleAddFiles = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    uploadMutation.reset();
    setSelectedDocumentTask(null);
    onChange([...files, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    uploadMutation.reset();
    setSelectedDocumentTask(null);
    onChange(files.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleSelectDocumentTask = (task: TaskType) => {
    setSelectedDocumentTask(task);
    if (uploadMutation.data?.dataset_type === 'documents') {
      onUploadSuccess({
        dataset_id: uploadMutation.data.dataset_id,
        taskType: task,
      });
    }
  };

  const handleUpload = () => {
    if (files.length === 0 || validationError) return;
    setSelectedDocumentTask(null);
    uploadMutation.mutate(files, {
      onSuccess: (data) => {
        if (data.dataset_type === 'structured') {
          onUploadSuccess({
            dataset_id: data.dataset_id,
            taskType: detectedTaskFromUpload(data),
          });
        }
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleAddFiles(droppedFiles);
  };

  const task = TASK_TYPES.find((t) => t.id === activeTask)!;
  const TaskIcon = task.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Upload Dataset</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Upload CSV/JSONL datasets or multiple PDF/DOC/DOCX files.
        {showStructuredGuidance ? (
          <>
            {' '}
            For structured datasets, Summarization requires{' '}
            <span className="font-mono text-foreground/80">
              document
            </span> and{' '}
            <span className="font-mono text-foreground/80">summary</span>;
            classification requires{' '}
            <span className="font-mono text-foreground/80">document</span> and{' '}
            <span className="font-mono text-foreground/80">class</span>. Task
            type is inferred from your columns.
          </>
        ) : (
          <>
            {' '}
            For document uploads, choose the task type after upload completes.
          </>
        )}
      </p>

      {showStructuredGuidance && (
        <>
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
              Dataset type
            </p>
            <TaskTypeButtons selected={activeTask} onSelect={setActiveTask} />
          </div>

          <motion.div
            key={activeTask}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="rounded-xl border border-border bg-surface p-4 mb-6 space-y-4"
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                <TaskIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{task.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {task.description}
                </p>
              </div>
            </div>

            {/* Columns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Required columns
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {task.requiredColumns.map((col) => (
                    <span
                      key={col}
                      className="inline-flex items-center rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-mono font-medium text-primary"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5"></p>

                <span className="text-xs text-muted-foreground italic"></span>
              </div>
            </div>

            {/* Metrics */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Evaluation metrics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {task.metrics.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground/70"
                  >
                    <Sparkles className="mr-1 h-2.5 w-2.5 text-muted-foreground" />
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Auto-detection note */}
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
              <div className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Auto-detection:{' '}
                </span>
                {task.autoDetect}
              </p>
            </div>

            {/* Format example */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Format example
                </p>
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  <button
                    onClick={() => setFormatTab('csv')}
                    className={cn(
                      'px-2.5 py-1 font-mono transition-colors',
                      formatTab === 'csv'
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'bg-surface text-muted-foreground hover:text-foreground',
                    )}
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => setFormatTab('jsonl')}
                    className={cn(
                      'px-2.5 py-1 font-mono transition-colors border-l border-border',
                      formatTab === 'jsonl'
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'bg-surface text-muted-foreground hover:text-foreground',
                    )}
                  >
                    JSONL
                  </button>
                </div>
              </div>
              <pre className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre leading-relaxed">
                {formatTab === 'csv' ? task.csvExample : task.jsonlExample}
              </pre>
            </div>
          </motion.div>
        </>
      )}

      {/* ── Upload zone ── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-xl border-2 border-dashed p-12 text-center transition-all',
          dragOver ? 'border-primary bg-primary/5' : 'border-border bg-surface',
        )}
      >
        <input
          type="file"
          multiple
          accept=".csv,.jsonl,.pdf,.doc,.docx"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploadMutation.isPending}
          onChange={(e) => {
            handleAddFiles(Array.from(e.target.files ?? []));
            e.currentTarget.value = '';
          }}
        />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          CSV/JSONL (single file) or PDF/DOC/DOCX (multiple files) · up to 200
          MB total
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
            Selected files ({files.length})
          </div>
          <div className="divide-y divide-border">
            {files.map((selectedFile, index) => (
              <div
                key={`${selectedFile.name}-${selectedFile.size}-${index}`}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadMutation.isPending}
                  onClick={() => handleRemoveFile(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {validationError && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {validationError}
        </p>
      )}

      <Button
        onClick={handleUpload}
        className="mt-4 w-full"
        disabled={
          files.length === 0 ||
          !!validationError ||
          uploadMutation.isPending ||
          uploadMutation.isSuccess
        }
      >
        {uploadMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading…
          </>
        ) : (
          'Upload'
        )}
      </Button>

      {/* ── Upload status ── */}
      {files.length > 0 && (
        <div
          className={cn(
            'mt-4 flex items-center gap-3 rounded-lg p-4 shadow-card',
            uploadMutation.isSuccess
              ? 'bg-accent/5'
              : uploadMutation.isError
                ? 'bg-destructive/5'
                : 'bg-surface',
          )}
        >
          {uploadMutation.isPending && (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">Uploading dataset…</span>
            </>
          )}
          {uploadMutation.isSuccess && (
            <>
              <FileCheck className="h-4 w-4 text-accent" />
              <div>
                <span className="text-sm font-medium">Upload complete</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {uploadMutation.data.dataset_type === 'structured'
                    ? `${uploadMutation.data.sample_count} samples — ${
                        uploadMutation.data.has_summary
                          ? 'Summarization'
                          : uploadMutation.data.has_class
                            ? 'Classification'
                            : 'Ready'
                      }`
                    : `${uploadMutation.data.file_count} files uploaded`}
                </span>
              </div>
            </>
          )}
          {uploadMutation.isError && (
            <>
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                {uploadMutation.error.message}
              </span>
            </>
          )}
        </div>
      )}

      {isDocumentUploadSuccess && (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
            Task type
          </p>
          <TaskTypeButtons
            selected={selectedDocumentTask ?? 'summarization'}
            onSelect={handleSelectDocumentTask}
          />
          {!selectedDocumentTask && (
            <p className="mt-2 text-xs text-muted-foreground">
              Select a task type to configure metrics.
            </p>
          )}
        </div>
      )}

      {uploadMutation.isSuccess &&
        (!isDocumentUploadSuccess || selectedDocumentTask) && (
          <div className="mt-6">
            <MetricsPicker
              metrics={metrics}
              onChange={onMetricsChange}
              taskType={metricsTaskType}
            />
            {!hasAtLeastOneMetric(metrics) && (
              <p className="mt-2 text-xs text-destructive" role="alert">
                Select at least one accuracy metric to continue.
              </p>
            )}
          </div>
        )}

      {uploadMutation.isSuccess && (
        <Button
          onClick={onStartEvaluation}
          className="mt-6 w-full"
          size="lg"
          disabled={isStarting || !canStartEvaluation}
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            'Start Evaluation'
          )}
        </Button>
      )}
    </motion.div>
  );
}
