import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { STAGE_BY_STATE_NAME } from '../../services/StateMachineService/StateMachineSfnService';

const templatePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../infrastructure/preprocessing.yaml',
);

describe('STAGE_BY_STATE_NAME', () => {
  it('covers exactly the Task states of the preprocessing state machine', () => {
    const template = parse(readFileSync(templatePath, 'utf8'), {
      logLevel: 'silent',
    }) as {
      Resources: {
        PreprocessingStateMachine: {
          Properties: {
            Definition: { States: Record<string, { Type: string }> };
          };
        };
      };
    };

    const taskStateNames = Object.entries(
      template.Resources.PreprocessingStateMachine.Properties.Definition.States,
    )
      .filter(([, state]) => state.Type === 'Task')
      .map(([name]) => name);

    expect(taskStateNames.toSorted()).toEqual(
      Object.keys(STAGE_BY_STATE_NAME).toSorted(),
    );
  });
});
