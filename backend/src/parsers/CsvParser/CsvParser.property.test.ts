import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CsvParserImpl } from './CsvParser';

/**
 * Property-Based Tests for CSV Parser
 *
 * These tests use fast-check to generate various CSV structures
 * and verify that validation logic holds across all cases.
 */
describe('CsvParser - Property-Based Tests', () => {
  const parser = new CsvParserImpl();

  describe('Property 1: CSV Validation', () => {
    /**
     * **Validates: Requirements 1.1**
     *
     * For any CSV file, the Dataset_Uploader should validate that it contains
     * a "document" column, and reject files without this required column.
     */
    it('should accept any CSV with a "document" column', () => {
      fc.assert(
        fc.property(
          fc.record({
            additionalColumns: fc.array(
              fc
                .string({ minLength: 1, maxLength: 20 })
                .filter(
                  (s) =>
                    s !== 'document' && !s.includes(',') && !s.includes('"'),
                ),
              { minLength: 0, maxLength: 5 },
            ),
            rows: fc.array(
              fc
                .record({
                  document: fc.string({ minLength: 1, maxLength: 100 }),
                  additionalValues: fc.array(fc.string({ maxLength: 50 }), {
                    maxLength: 5,
                  }),
                })
                .filter((row) => row.document.trim() !== ''),
              { minLength: 1, maxLength: 10 },
            ),
            documentPosition: fc.nat({ max: 5 }),
          }),
          ({ additionalColumns, rows, documentPosition }) => {
            const columns = [...additionalColumns];
            columns.splice(
              Math.min(documentPosition, columns.length),
              0,
              'document',
            );

            const header = columns.join(',');
            const dataRows = rows.map((row) => {
              const values = [...row.additionalValues];
              const documentIndex = Math.min(
                documentPosition,
                additionalColumns.length,
              );
              values.splice(documentIndex, 0, escapeCSVValue(row.document));

              while (values.length < columns.length) {
                values.push('');
              }
              values.length = columns.length;

              return values.map((v) => escapeCSVValue(v)).join(',');
            });

            const csv = [header, ...dataRows].join('\n');
            const result = parser.parse(csv);

            expect(result).toHaveProperty('samples');
            expect(Array.isArray(result.samples)).toBe(true);
            expect(result.samples.length).toBeGreaterThan(0);

            result.samples.forEach((sample) => {
              expect(sample).toHaveProperty('document');
              expect(typeof sample.document).toBe('string');
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject any CSV without a "document" column', () => {
      fc.assert(
        fc.property(
          fc.record({
            columns: fc.array(
              fc
                .string({ minLength: 1, maxLength: 20 })
                .filter(
                  (s) =>
                    s.trim() !== '' &&
                    s !== 'document' &&
                    !s.includes(',') &&
                    !s.includes('"'),
                ),
              { minLength: 1, maxLength: 5 },
            ),
            rows: fc.array(
              fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
                minLength: 1,
                maxLength: 5,
              }),
              { minLength: 1, maxLength: 10 },
            ),
          }),
          ({ columns, rows }) => {
            const filteredColumns = columns.filter(
              (c) => c !== 'document' && c.trim() !== '',
            );

            if (filteredColumns.length === 0) {
              return true;
            }

            const header = filteredColumns.join(',');
            const dataRows = rows.map((row) => {
              const values = row.slice(0, filteredColumns.length);
              while (values.length < filteredColumns.length) {
                values.push('value');
              }
              return values.map((v) => escapeCSVValue(v)).join(',');
            });

            const csv = [header, ...dataRows].join('\n');

            expect(() => parser.parse(csv)).toThrow(
              'CSV file must contain a "document" column',
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should accept CSV with "document" column regardless of other columns', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasSummary: fc.boolean(),
            hasClass: fc.boolean(),
            otherColumns: fc.array(
              fc
                .string({ minLength: 1, maxLength: 20 })
                .filter(
                  (s) =>
                    s.trim() !== '' &&
                    !['document', 'summary', 'class'].includes(s) &&
                    !s.includes(',') &&
                    !s.includes('"'),
                ),
              { minLength: 0, maxLength: 3 },
            ),
            rows: fc.array(
              fc.record({
                document: fc
                  .string({ minLength: 1, maxLength: 100 })
                  .filter((s) => s.trim() !== '' && s === s.trim()),
                summary: fc.option(
                  fc
                    .string({ minLength: 1, maxLength: 100 })
                    .filter((s) => s.trim() !== '' && s === s.trim()),
                  { nil: undefined },
                ),
                classLabel: fc.option(
                  fc
                    .string({ minLength: 1, maxLength: 100 })
                    .filter((s) => s.trim() !== '' && s === s.trim()),
                  { nil: undefined },
                ),
                otherValues: fc.array(fc.string({ maxLength: 50 }), {
                  maxLength: 3,
                }),
              }),
              { minLength: 1, maxLength: 10 },
            ),
          }),
          ({ hasSummary, hasClass, otherColumns, rows }) => {
            const columns = ['document'];
            if (hasSummary) columns.push('summary');
            if (hasClass) columns.push('class');
            columns.push(...otherColumns);

            const header = columns.join(',');
            const dataRows = rows.map((row) => {
              const values: string[] = [escapeCSVValue(row.document)];
              if (hasSummary) values.push(escapeCSVValue(row.summary || ''));
              if (hasClass) values.push(escapeCSVValue(row.classLabel || ''));

              const otherVals = row.otherValues.slice(0, otherColumns.length);
              while (otherVals.length < otherColumns.length) {
                otherVals.push('');
              }
              values.push(...otherVals.map((v) => escapeCSVValue(v)));

              return values.join(',');
            });

            const csv = [header, ...dataRows].join('\n');
            const result = parser.parse(csv);

            expect(result.samples.length).toBe(rows.length);
            result.samples.forEach((sample, idx) => {
              const expectedDocument = unescapeCSVValue(
                escapeCSVValue(rows[idx].document),
              );
              expect(sample.document).toBe(expectedDocument);

              if (hasSummary && rows[idx].summary && rows[idx].summary !== '') {
                const expectedSummary = unescapeCSVValue(
                  escapeCSVValue(rows[idx].summary),
                );
                expect(sample.summary).toBe(expectedSummary);
              } else {
                expect(sample.summary).toBeUndefined();
              }

              if (
                hasClass &&
                rows[idx].classLabel &&
                rows[idx].classLabel !== ''
              ) {
                const expectedClass = unescapeCSVValue(
                  escapeCSVValue(rows[idx].classLabel),
                );
                expect(sample.class_label).toBe(expectedClass);
              } else {
                expect(sample.class_label).toBeUndefined();
              }
            });
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

function escapeCSVValue(value: string): string {
  if (!value) return '';

  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function unescapeCSVValue(value: string): string {
  if (!value) return '';

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"');
  }

  return value;
}
