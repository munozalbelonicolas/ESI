import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Base JS recommendations
  js.configs.recommended,

  // TypeScript
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        crypto: 'readonly',
        FormData: 'readonly',
        FileReader: 'readonly',
        HTMLInputElement: 'readonly',
        URL: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        React: 'readonly',
        confirm: 'readonly',
        TextEncoder: 'readonly',
        File: 'readonly',
        Image: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,

      // Permitir variables no usadas si empiezan con _
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Permite any cuando es necesario (Firebase, third-party)
      '@typescript-eslint/no-explicit-any': 'off',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-undef': 'off', // TypeScript ya maneja esto via tsc
    },
  },

  // Prettier: desactiva reglas que entran en conflicto
  prettierConfig,

  // Ignorar
  {
    ignores: ['dist/**', 'node_modules/**', '.git/**', '*.config.js', 'api/**', 'dist/sw.js', 'public/sw.js'],
  },
];
