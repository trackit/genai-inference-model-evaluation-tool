import { createInjectionToken } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { Dataset } from '../../models/Dataset';

export type JsonlParser = {
  parse(content: string): Dataset;
};

export class JsonlParserImpl implements JsonlParser {
  parse(content: string): Dataset {
    const lines = content.trim().split('\n');

    const samples = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const obj = JSON.parse(line);

        if (!obj.document) {
          throw new BasicError(
            BasicErrorType.UNPROCESSABLE_ENTITY,
            'MISSING_DOCUMENT',
            'Each line must contain a "document" field',
          );
        }

        const sample: {
          document: string;
          summary?: string;
          class_label?: string;
        } = {
          document: obj.document,
        };

        if (obj.summary && obj.summary !== '') {
          sample.summary = obj.summary;
        }

        if (obj.class && obj.class !== '') {
          sample.class_label = obj.class;
        }

        samples.push(sample);
      } catch (error) {
        if (error instanceof BasicError) throw error;
        if (error instanceof SyntaxError) {
          throw new BasicError(
            BasicErrorType.UNPROCESSABLE_ENTITY,
            'INVALID_FORMAT',
            `Error parsing line ${i + 1}: Invalid JSON`,
          );
        }
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown parsing error';
        throw new BasicError(
          BasicErrorType.UNPROCESSABLE_ENTITY,
          'INVALID_FORMAT',
          `Error parsing line ${i + 1}: ${errorMessage}`,
        );
      }
    }

    return { samples };
  }
}

export const tokenJsonlParser = createInjectionToken<JsonlParser>(
  'JsonlParser',
  { useClass: JsonlParserImpl },
);
