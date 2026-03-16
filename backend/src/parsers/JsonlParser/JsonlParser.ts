import { Dataset } from '../../types/Dataset';

export class JsonlParser {
  parse(content: string): Dataset {
    const lines = content.trim().split('\n');

    const samples = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const obj = JSON.parse(line);

        if (!obj.prompt) {
          throw new Error('Each line must contain a "prompt" field');
        }

        const sample: any = {
          prompt: obj.prompt,
        };

        if (obj.context && obj.context !== '') {
          sample.context = obj.context;
        }

        if (obj.reference_output && obj.reference_output !== '') {
          sample.reference_output = obj.reference_output;
        }

        samples.push(sample);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(`Error parsing line ${i + 1}: Invalid JSON`);
        }
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown parsing error';
        throw new Error(`Error parsing line ${i + 1}: ${errorMessage}`);
      }
    }

    return { samples };
  }
}
