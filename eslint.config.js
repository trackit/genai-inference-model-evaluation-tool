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
