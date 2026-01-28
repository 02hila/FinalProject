/**
 * eslint.config.js -- ESLint Flat Configuration
 *
 * Purpose:
 *   Defines linting rules for the React client using the new ESLint flat-config
 *   format. Applies recommended JavaScript rules plus React-specific plugins for
 *   hooks correctness and React Refresh compatibility.
 *
 * Key settings:
 *   - Ignores the dist/ build output.
 *   - Targets all .js and .jsx files.
 *   - Extends: eslint recommended, react-hooks recommended, react-refresh (Vite).
 *   - Custom rule: unused variables whose names start with an uppercase letter or
 *     underscore are allowed (varsIgnorePattern: '^[A-Z_]'), which accommodates
 *     imported React components that are only used in JSX.
 *
 * Connections:
 *   - Invoked by the "lint" npm script in package.json.
 *   - Works alongside vite.config.js (both target the same source files).
 */

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
