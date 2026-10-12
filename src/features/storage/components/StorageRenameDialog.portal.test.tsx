/**
 * @vitest-environment jsdom
 *
 * 고객 파일 폴더 생성 백드롭은 document.body portal + fixed inset 이어야 한다.
 * 페이지 패널 안에 두면 탭 바 stacking context 가 딤을 가린다.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import StorageRenameDialog from './StorageRenameDialog'

describe('StorageRenameDialog 폴더 생성 백드롭', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    document.body.querySelectorAll('.customer-ui-modal-backdrop').forEach((node) => node.remove())
  })

  async function renderDialog(props: { open: boolean; footerVariant: 'storage' | 'workspace' }) {
    await act(async () => {
      root.render(
        <StorageRenameDialog
          open={props.open}
          title="폴더 생성"
          value=""
          folderCreate
          footerVariant={props.footerVariant}
          onChange={() => undefined}
          onClose={() => undefined}
          onSubmit={() => undefined}
        />,
      )
    })
  }

  function folderBackdrop(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>(
      ':scope > .customer-ui-modal-backdrop:has(.file-folder-create-modal)',
    )
  }

  it('PC(storage) 모달은 body 로 portal 되고 백드롭은 fixed inset 이다', async () => {
    await renderDialog({ open: true, footerVariant: 'storage' })

    const backdrop = folderBackdrop()
    expect(backdrop).not.toBeNull()
    expect(host.querySelector('.customer-ui-modal-backdrop')).toBeNull()
    expect(backdrop?.className).toContain('fixed')
    expect(backdrop?.className).toContain('inset-0')
    expect(backdrop?.className).toContain('z-[10000]')
    expect(backdrop?.querySelector('.file-folder-create-modal')).not.toBeNull()
  })

  it('모바일(workspace) 모달도 body portal 을 유지한다', async () => {
    await renderDialog({ open: true, footerVariant: 'workspace' })

    const backdrop = folderBackdrop()
    expect(backdrop).not.toBeNull()
    expect(host.querySelector('.customer-ui-modal-backdrop')).toBeNull()
    expect(backdrop?.className).toContain('fixed')
    expect(backdrop?.className).toContain('inset-0')
    expect(backdrop?.className).toContain('z-[10000]')
  })

  it('닫혀 있으면 백드롭을 남기지 않는다', async () => {
    await renderDialog({ open: false, footerVariant: 'storage' })
    expect(folderBackdrop()).toBeNull()
  })
})
