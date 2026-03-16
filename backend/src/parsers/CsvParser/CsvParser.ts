import { Dataset } from '../../types/Dataset';

export class CsvParser {
  parse(content: string): Dataset {
    const lines = content.trim().split('\n');

    if (lines.length < 2) {
      throw new Error(
        'CSV file must contain a header row and at least one data row',
      );
    }

    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine);

    const promptIndex = headers.indexOf('prompt');
    if (promptIndex === -1) {
      throw new Error('CSV file must contain a "prompt" column');
    }

    const contextIndex = headers.indexOf('context');
    const referenceOutputIndex = headers.indexOf('reference_output');

    const samples = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line);

        if (values.length !== headers.length) {
          throw new Error(
            `Expected ${headers.length} columns but found ${values.length}`,
          );
        }

        const sample: any = {
          prompt: values[promptIndex],
        };

        if (
          contextIndex !== -1 &&
          values[contextIndex] &&
          values[contextIndex] !== ''
        ) {
          sample.context = values[contextIndex];
        }

        if (
          referenceOutputIndex !== -1 &&
          values[referenceOutputIndex] &&
          values[referenceOutputIndex] !== ''
        ) {
          sample.reference_output = values[referenceOutputIndex];
        }

        samples.push(sample);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown parsing error';
        throw new Error(`Error parsing row ${i + 1}: ${errorMessage}`);
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
