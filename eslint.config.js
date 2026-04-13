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

const uiComponentRestrictionRules = [
  {
    selector: 'CallExpression[callee.object.name="window"][callee.property.name="confirm"]',
    message: 'window.confirm 대신 ConfirmDialog를 사용하세요.',
  },
  {
    selector: 'JSXOpeningElement[name.name="button"]',
    message: 'button 대신 FormButton을 사용하세요.',
  },
  {
    selector: 'JSXOpeningElement[name.name="input"]',
    message: 'input 대신 FormInput을 사용하세요.',
  },
  {
    selector: 'JSXOpeningElement[name.name="select"]',
    message: 'select 대신 FormSelect를 사용하세요.',
  },
  {
    selector: 'JSXOpeningElement[name.name="textarea"]',
    message: 'textarea 대신 FormTextarea를 사용하세요.',
  },
]

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
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ignores: [
      'src/**/*.d.ts',
      // 공통 컴포넌트 내부에서는 기본 HTML 요소를 감싼다.
      'src/components/form/FormInput.tsx',
      'src/components/form/FormSelect.tsx',
      'src/components/form/FormTextarea.tsx',
      'src/components/ui/Button.tsx',
      'src/components/ui/Input.tsx',
      /* Canvas·PDF 렌더링은 픽셀 색 고정이 필요해 UI 토큰 규칙 제외 */
      'src/features/consent/components/SignatureModal.tsx',
      'src/features/consent/admin/components/PdfCoordinateOverlay.tsx',
      'src/features/application/services/exportService.ts',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'confirm',
          message: 'window.confirm 대신 ConfirmDialog를 사용하세요.',
        },
      ],
      'no-restricted-syntax': ['error', ...hexLiteralRules, ...uiComponentRestrictionRules],
    },
  },
])
