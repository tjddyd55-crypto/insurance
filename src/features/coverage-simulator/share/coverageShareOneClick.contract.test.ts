import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const featureRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function readFeature(relativePath: string) {
  return readFileSync(join(featureRoot, relativePath), 'utf8')
}

describe('coverage share one-click copy on the 3-pane editor', () => {
  const editor = readFeature('components/center-timeline/CenterAxisCompareEditor.tsx')
  const header = readFeature('components/MobilePreviewEditorHeader.tsx')
  const hook = readFeature('hooks/useCoverageShareFlow.tsx')

  it('copies from the main share action and opens history only from 이력', () => {
    expect(editor).toContain('onClick={() => void shareFlow.shareAndCopy()}')
    expect(editor).toContain('onShare={shareFlow.showShareButton ? () => void shareFlow.shareAndCopy() : undefined}')
    expect(editor).toContain('onShareHistory={shareFlow.showShareButton ? () => void shareFlow.openShareDialog() : undefined}')
    expect(editor).toContain('onClick={() => void shareFlow.openShareDialog()}')
    expect(editor).toContain('aria-label="공유 이력"')
    expect(editor).not.toMatch(/shareFlow\.openShareDialog\(\)[\s\S]{0,160}공유 중/)
    expect(header).toContain('aria-label="공유 이력"')
    expect(header).toContain('onClick={onShareHistory}')
  })

  it('shows 복사되었습니다. and does not reuse an in-memory URL', () => {
    const shareAndCopy = hook.slice(hook.indexOf('const shareAndCopy'), hook.indexOf('const copyHistoryLink'))
    const openShareDialog = hook.slice(hook.indexOf('const openShareDialog'), hook.indexOf('const uploadPdfInBackground'))
    expect(hook).toContain("const SHARE_COPIED_TOAST = '복사되었습니다.'")
    expect(hook).not.toContain('if (shareResult?.shareUrl) return shareResult.shareUrl')
    expect(shareAndCopy).toContain('provider.createShare(snapshot)')
    expect(shareAndCopy).toContain('copyTextToClipboard(created.shareUrl)')
    expect(shareAndCopy).toContain('SHARE_COPIED_TOAST')
    expect(shareAndCopy).not.toContain('setDialogOpen')
    expect(openShareDialog).not.toContain('createShare')
    expect(openShareDialog).toContain('setDialogOpen(true)')
  })
})