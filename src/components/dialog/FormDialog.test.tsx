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

const { FormDialog } = await import('./FormDialog')

describe('FormDialog', () => {
  beforeEach(() => {
    baseDialogMock.mockClear()
  })

  it('defaults to blocking backdrop and ESC dismiss', () => {
    renderToStaticMarkup(
      createElement(
        FormDialog,
        {
          open: true,
          title: '입력',
          onClose: vi.fn(),
        },
        '본문',
      ),
    )

    expect(baseDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        closeOnBackdrop: false,
        closeOnEsc: false,
      }),
    )
  })
})
