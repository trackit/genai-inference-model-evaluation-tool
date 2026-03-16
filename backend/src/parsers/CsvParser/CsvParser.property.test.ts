import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CsvParser } from './CsvParser';

/**
 * Property-Based Tests for CSV Parser
 *
 * These tests use fast-check to generate various CSV structures
 * and verify that validation logic holds across all cases.
 */
describe('CsvParser - Property-Based Tests', () => {
  const parser = new CsvParser();

  describe('Property 1: CSV Validation', () => {
    /**
     * **Validates: Requirements 1.1**
     *
     * For any CSV file, the Dataset_Uploader should validate that it contains
     * a "prompt" column, and reject files without this required column.
     */
    it('should accept any CSV with a "prompt" column', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary CSV data with a "prompt" column
          fc.record({
            // Generate additional column names (excluding "prompt")
            additionalColumns: fc.array(
              fc
                .string({ minLength: 1, maxLength: 20 })
                .filter(
                  (s) => s !== 'prompt' && !s.includes(',') && !s.includes('"'),
                ),
              { minLength: 0, maxLength: 5 },
            ),
            // Generate rows of data
            rows: fc.array(
              fc
                .record({
                  prompt: fc.string({ minLength: 1, maxLength: 100 }),
                  additionalValues: fc.array(fc.string({ maxLength: 50 }), {
                    maxLength: 5,
                  }),
                })
                .filter((row) => row.prompt.trim() !== ''), // Ensure prompt is not just whitespace
              { minLength: 1, maxLength: 10 },
            ),
            // Randomly position the "prompt" column
            promptPosition: fc.nat({ max: 5 }),
          }),
          ({ additionalColumns, rows, promptPosition }) => {
            // Build column headers with "prompt" at the specified position
            const columns = [...additionalColumns];
            columns.splice(
              Math.min(promptPosition, columns.length),
              0,
              'prompt',
            );

            // Build CSV content
            const header = columns.join(',');
            const dataRows = rows.map((row) => {
              const values = [...row.additionalValues];
              const promptIndex = Math.min(
                promptPosition,
                additionalColumns.length,
              );
              values.splice(promptIndex, 0, escapeCSVValue(row.prompt));

              // Pad or trim to match column count
              while (values.length < columns.length) {
                values.push('');
              }
              values.length = columns.length;

              return values.map((v) => escapeCSVValue(v)).join(',');
            });

            const csv = [header, ...dataRows].join('\n');

            // The parser should successfully parse any CSV with a "prompt" column
            const result = parser.parse(csv);

            // Verify the result has the expected structure
            expect(result).toHaveProperty('samples');
            expect(Array.isArray(result.samples)).toBe(true);
            expect(result.samples.length).toBeGreaterThan(0);

            // Verify all samples have a prompt field
            result.samples.forEach((sample) => {
              expect(sample).toHaveProperty('prompt');
              expect(typeof sample.prompt).toBe('string');
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject any CSV without a "prompt" column', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary CSV data WITHOUT a "prompt" column
          fc.record({
            // Generate column names that are NOT "prompt" (non-empty after trim)
            columns: fc.array(
              fc
                .string({ minLength: 1, maxLength: 20 })
                .filter(
                  (s) =>
                    s.trim() !== '' &&
                    s !== 'prompt' &&
                    !s.includes(',') &&
                    !s.includes('"'),
                ),
              { minLength: 1, maxLength: 5 },
            ),
            // Generate rows of data (at least one non-empty row)
            rows: fc.array(
              fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
                minLength: 1,
                maxLength: 5,
              }),
              { minLength: 1, maxLength: 10 },
            ),
          }),
          ({ columns, rows }) => {
            // Ensure we don't accidentally include "prompt"
            const filteredColumns = columns.filter(
              (c) => c !== 'prompt' && c.trim() !== '',
            );

            // Skip if no columns remain
            if (filteredColumns.length === 0) {
              return true; // Skip this test case
            }

            // Build CSV content with at least one non-empty data row
            const header = filteredColumns.join(',');
            const dataRows = rows.map((row) => {
              const values = row.slice(0, filteredColumns.length);
              while (values.length < filteredColumns.length) {
                values.push('value');
              }
              return values.map((v) => escapeCSVValue(v)).join(',');
            });

            const csv = [header, ...dataRows].join('\n');

            // The parser should reject CSV files without a "prompt" column
            expect(() => parser.parse(csv)).toThrow(
              'CSV file must contain a "prompt" column',
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should accept CSV with "prompt" column regardless of other columns', () => {
      fc.assert(
        fc.property(
          // Generate CSV with "prompt" and various other columns
          fc.record({
            hasContext: fc.boolean(),
            hasReferenceOutput: fc.boolean(),
            otherColumns: fc.array(
              fc
                .string({ minLength: 1, maxLength: 20 })
                .filter(
                  (s) =>
                    s.trim() !== '' &&
                    !['prompt', 'context', 'reference_output'].includes(s) &&
                    !s.includes(',') &&
                    !s.includes('"'),
                ),
              { minLength: 0, maxLength: 3 },
            ),
            rows: fc.array(
              fc.record({
                prompt: fc
                  .string({ minLength: 1, maxLength: 100 })
                  .filter((s) => s.trim() !== '' && s === s.trim()), // No leading/trailing whitespace
                context: fc.option(
                  fc
                    .string({ minLength: 1, maxLength: 100 })
                    .filter((s) => s.trim() !== '' && s === s.trim()), // No leading/trailing whitespace
                  { nil: undefined },
                ),
                referenceOutput: fc.option(
                  fc
                    .string({ minLength: 1, maxLength: 100 })
                    .filter((s) => s.trim() !== '' && s === s.trim()), // No leading/trailing whitespace
                  { nil: undefined },
                ),
                otherValues: fc.array(fc.string({ maxLength: 50 }), {
                  maxLength: 3,
                }),
              }),
              { minLength: 1, maxLength: 10 },
            ),
          }),
          ({ hasContext, hasReferenceOutput, otherColumns, rows }) => {
            // Build columns
            const columns = ['prompt'];
            if (hasContext) columns.push('context');
            if (hasReferenceOutput) columns.push('reference_output');
            columns.push(...otherColumns);

            // Build CSV
            const header = columns.join(',');
            const dataRows = rows.map((row) => {
              const values: string[] = [escapeCSVValue(row.prompt)];
              if (hasContext) values.push(escapeCSVValue(row.context || ''));
              if (hasReferenceOutput)
                values.push(escapeCSVValue(row.referenceOutput || ''));

              // Add other values
              const otherVals = row.otherValues.slice(0, otherColumns.length);
              while (otherVals.length < otherColumns.length) {
                otherVals.push('');
              }
              values.push(...otherVals.map((v) => escapeCSVValue(v)));

              return values.join(',');
            });

            const csv = [header, ...dataRows].join('\n');

            // Should parse successfully
            const result = parser.parse(csv);

            expect(result.samples.length).toBe(rows.length);
            result.samples.forEach((sample, idx) => {
              // Since we filter out leading/trailing whitespace in generators,
              // values should match exactly after CSV round-trip
              const expectedPrompt = unescapeCSVValue(
                escapeCSVValue(rows[idx].prompt),
              );
              expect(sample.prompt).toBe(expectedPrompt);

              // For optional fields, the parser only includes them if they exist and are non-empty
              if (hasContext && rows[idx].context && rows[idx].context !== '') {
                const expectedContext = unescapeCSVValue(
                  escapeCSVValue(rows[idx].context),
                );
                expect(sample.context).toBe(expectedContext);
              } else {
                expect(sample.context).toBeUndefined();
              }

              if (
                hasReferenceOutput &&
                rows[idx].referenceOutput &&
                rows[idx].referenceOutput !== ''
              ) {
                const expectedRef = unescapeCSVValue(
                  escapeCSVValue(rows[idx].referenceOutput),
                );
                expect(sample.reference_output).toBe(expectedRef);
              } else {
                expect(sample.reference_output).toBeUndefined();
              }
            });
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

/**
 * Helper function to escape CSV values
 */
function escapeCSVValue(value: string): string {
  if (!value) return '';

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/**
 * Helper function to unescape CSV values (reverse of escapeCSVValue)
 */
function unescapeCSVValue(value: string): string {
  if (!value) return '';

  // If value is wrapped in quotes, remove them and unescape internal quotes
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"');
  }

  return value;
}
