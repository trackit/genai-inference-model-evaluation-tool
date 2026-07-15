import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  [
    {
      files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
      plugins: { js },
      extends: ['js/recommended'],
      languageOptions: {
        globals: globals.node,
        parser: tseslint.parser,
        parserOptions: {
          project: './tsconfig.json',
          tsconfigRootDir: import.meta.dirname,
        },
      },
    },
    tseslint.configs.recommended,
    {
      rules: {
        '@typescript-eslint/triple-slash-reference': 'off',
      },
    },
    {
      files: ['**/*.{ts,mts,cts}'],
      ignores: [
        '**/DatasetServiceS3.ts',
        '**/DatasetServiceS3.test.ts',
        '**/FakeDatasetService.ts',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/s3Keys.internal'],
                message:
                  's3Keys.internal is private to DatasetServiceS3, its test, and FakeDatasetService. Do not import it from other files.',
              },
            ],
          },
        ],
      },
    },
    eslintConfigPrettier,
  ],
  {
    ignores: [
      '**/dist/',
      '**/node_modules/',
      '.aws-sam/',
      'frontend/',
      'eslint.config.js',
    ],
  },
);
