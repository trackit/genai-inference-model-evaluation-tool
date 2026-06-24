import { createInjectionToken } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { Dataset } from '../../models/Dataset';

export type CsvParser = {
  parse(content: string): Dataset;
};

export class CsvParserImpl implements CsvParser {
  parse(content: string): Dataset {
    const lines = content.trim().split('\n');

    if (lines.length < 2) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'INVALID_FORMAT',
        'CSV file must contain a header row and at least one data row',
      );
    }

    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine);

    const documentIndex = headers.indexOf('document');
    if (documentIndex === -1) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'MISSING_DOCUMENT',
        'CSV file must contain a "document" column',
      );
    }

    const summaryIndex = headers.indexOf('summary');
    const classIndex = headers.indexOf('class');

    const samples = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line);

        if (values.length !== headers.length) {
          throw new BasicError(
            BasicErrorType.UNPROCESSABLE_ENTITY,
            'INVALID_FORMAT',
            `Expected ${headers.length} columns but found ${values.length}`,
          );
        }

        const sample: {
          document: string;
          summary?: string;
          class_label?: string;
        } = {
          document: values[documentIndex],
        };

        if (
          summaryIndex !== -1 &&
          values[summaryIndex] &&
          values[summaryIndex] !== ''
        ) {
          sample.summary = values[summaryIndex];
        }

        if (
          classIndex !== -1 &&
          values[classIndex] &&
          values[classIndex] !== ''
        ) {
          sample.class_label = values[classIndex];
        }

        samples.push(sample);
      } catch (error) {
        if (error instanceof BasicError) throw error;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown parsing error';
        throw new BasicError(
          BasicErrorType.UNPROCESSABLE_ENTITY,
          'INVALID_FORMAT',
          `Error parsing row ${i + 1}: ${errorMessage}`,
        );
      }
    }

    return { samples };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }
}

export const tokenCsvParser = createInjectionToken<CsvParser>('CsvParser', {
  useClass: CsvParserImpl,
});
