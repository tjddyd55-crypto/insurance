import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const workspaceSource = readFileSync(join(dir, 'CoverageThreePaneWorkspace.tsx'), 'utf8')
const saveDialogSource = readFileSync(join(dir, 'SaveConsultationTitleDialog.tsx'), 'utf8')

describe('CoverageThreePaneWorkspace template actions', () => {
  it('refreshes template list via templateVersion dependency', () => {
    expect(workspaceSource).toContain('templateVersion')
    expect(workspaceSource).toMatch(
      /listScenarioTemplates\(userKey\)[\s\S]*templateVersion/,
    )
    expect(workspaceSource).toContain('setTemplateVersion')
    expect(workspaceSource).not.toContain('window.prompt')
    expect(workspaceSource).toContain('기본값 편집')
    expect(workspaceSource).toContain('시나리오 이름 변경')
  })

  it('uses modal SSOT for simulation title rename', () => {
    expect(workspaceSource).toContain('시뮬레이션 제목 수정')
    expect(saveDialogSource).toContain('CoverageSimulatorNameCreateDialog')
    expect(saveDialogSource).not.toContain('BaseDialog')
  })
})
