import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const baseDialogMock = vi.fn((_props: Record<string, unknown>) => null)

vi.mock('./BaseDialog', () => ({
  BaseDialog: (props: Record<string, unknown>) => {
    baseDialogMock(props)
    return null
  },
}))

vi.mock('../ui/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: unknown
    onClick?: () => void
    disabled?: boolean
  }) =>
    createElement(
      'button',
      { type: 'button', onClick, disabled },
      children,
    ),
}))

const { ConfirmDialog } = await import('./ConfirmDialog')

describe('ConfirmDialog', () => {
  beforeEach(() => {
    baseDialogMock.mockClear()
  })

  it('defaults to blocking backdrop and ESC dismiss', () => {
    renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: true,
        message: '삭제한 계정 정보는 복구할 수 없습니다.',
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
      }),
    )

    expect(baseDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        closeOnBackdrop: false,
        closeOnEsc: false,
      }),
    )
  })

  it('keeps backdrop blocked while busy even if closeOnBackdrop is true', () => {
    renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: true,
        message: '처리 중',
        busy: true,
        closeOnBackdrop: true,
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
      }),
    )

    expect(baseDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        closeOnBackdrop: false,
      }),
    )
  })

  it('allows opt-in backdrop dismiss when closeOnBackdrop is true', () => {
    renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: true,
        message: '안내',
        closeOnBackdrop: true,
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
      }),
    )

    expect(baseDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        closeOnBackdrop: true,
      }),
    )
  })
})
