import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOTS = ['src', 'electron', 'shared']

/** Binder, coverage simulator, and newsletter stay free of native dialogs. */
const IN_SCOPE_PREFIXES = [
  'src/features/personal-binder/',
  'src/features/coverage-simulator/',
  'src/features/insurer-news/',
]

/**
 * develop에 있던 사용자 대면 네이티브 다이얼로그.
 * 이번 범위 밖으로 되돌렸으므로 교체하지 않고 목록만 고정한다.
 */
const DEFERRED_OUT_OF_SCOPE = [
  'src/features/admin-notices/components/AdminNoticeRichEditor.tsx',
  'src/features/admin/pages/GaDelegateManagementPage.tsx',
  'src/features/admin/pages/GaGroupManagementPage.tsx',
  'src/features/admin/pages/GaManagementPage.tsx',
  'src/features/application/pages/ApplicationFormPage.tsx',
  'src/features/contracts/testConsole/components/EvidenceStatusPanel.tsx',
  'src/features/contracts/testConsole/components/SendSessionPanel.tsx',
  'src/features/contracts/userHistory/ContractSignatureHistoryPage.tsx',
  'src/features/customers/components/detail-quick-crud/CustomerCarsQuickSection.tsx',
  'src/features/customers/components/detail-quick-crud/CustomerCustomFieldsQuickInlineSection.tsx',
  'src/features/customers/components/detail-quick-crud/CustomerFireInsuranceQuickSection.tsx',
  'src/features/customers/components/detail-quick-crud/CustomerSpecialDatesQuickSection.tsx',
  'src/features/ga-approval/GaApprovalPanel.tsx',
  'src/features/insurance-claim/pages/ClaimRequestHistoryPage.tsx',
  'src/features/memo/components/MobileMemoFullScreenModal.tsx',
  'src/features/pdf-engine/components/PdfCoordinateEditor.tsx',
  'src/features/pdf-engine/pages/PdfTemplateListPage.tsx',
  'src/features/sms/hooks/useSmsAutomationRulesState.ts',
  'src/features/ta-call/components/TaCallSettingsDialog.tsx',
]

function walk(dir: string, acc: string[] = []): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of names) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, acc)
      continue
    }
    if (/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(name)) acc.push(full)
  }
  return acc
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function nativeDialogFiles(): string[] {
  const hits: string[] = []
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue
      const text = stripComments(readFileSync(file, 'utf8'))
      if (/\b(?:window|globalThis)\.(?:alert|confirm|prompt)\s*\(/.test(text)) hits.push(file)
      if (/\bshowMessageBox\s*\(/.test(text)) hits.push(`${file} showMessageBox`)
    }
  }
  return hits.sort()
}

describe('native dialog replacement', () => {
  it('keeps binder, coverage-simulator, and newsletter free of native dialogs', () => {
    const inScope = nativeDialogFiles().filter((file) =>
      IN_SCOPE_PREFIXES.some((prefix) => file.startsWith(prefix)),
    )
    expect(inScope).toEqual([])
  })

  it('leaves every other user-facing native dialog deferred and unchanged', () => {
    const deferred = nativeDialogFiles().filter(
      (file) => !IN_SCOPE_PREFIXES.some((prefix) => file.startsWith(prefix)),
    )
    expect(deferred).toEqual([...DEFERRED_OUT_OF_SCOPE].sort())
  })

  it('leaves the browser beforeunload guard as the only unload dialog', () => {
    const hits: string[] = []
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const text = stripComments(readFileSync(file, 'utf8'))
        if (/\bbeforeunload\b/.test(text) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')) {
          hits.push(file)
        }
      }
    }
    expect(hits).toEqual(['src/features/profile/components/UserGaExcelManagePanel.tsx'])
  })
})
