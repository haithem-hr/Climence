import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.tsx'],
    ignores: [
      'src/components/CommandCenterRedesign.tsx',
      'src/components/panels/DroneDiagnostics.tsx',
      'src/components/panels/HotspotsList.tsx',
      'src/components/panels/LiveMapView.tsx',
      'src/components/panels/ViewModeToggle.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'JSXText[value=/[A-Za-z]{3,}/]',
          message: 'Visible JSX copy should come from the i18n dictionary.',
        },
      ],
    },
  },
])
