import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Allow explicit `any` only in Leaflet CDN interop files
      '@typescript-eslint/no-explicit-any': 'warn',
      // Prefer const; minor style rule
      'prefer-const': 'error',
    },
  },
];

export default eslintConfig;
