import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const hexLiteralRules = [
  '#ffffff',
  '#FFFFFF',
  '#fff',
  '#FFF',
  '#000000',
  '#000',
].map((value) => ({
  selector: `Literal[value='${value}']`,
  message:
    'Use design tokens (CSS variables in theme / Tailwind theme colors) instead of raw hex in source.',
}))

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
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/**/*.d.ts',
      /* Canvas·PDF 렌더링은 픽셀 색 고정이 필요해 UI 토큰 규칙 제외 */
      'src/features/consent/components/SignatureModal.tsx',
      'src/features/consent/admin/components/PdfCoordinateOverlay.tsx',
      'src/features/application/services/exportService.ts',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...hexLiteralRules],
    },
  },
])
