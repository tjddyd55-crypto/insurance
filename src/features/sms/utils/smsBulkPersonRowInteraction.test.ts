import type { KeyboardEvent, MouseEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSmsBulkPersonRowHandlers } from './smsBulkPersonRowInteraction'

describe('createSmsBulkPersonRowHandlers', () => {
  it('calls onToggle when row is clicked', () => {
    const onToggle = vi.fn()
    const { handleRowClick } = createSmsBulkPersonRowHandlers(onToggle)

    handleRowClick()

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('toggles on and off when row is clicked twice', () => {
    const onToggle = vi.fn()
    const { handleRowClick } = createSmsBulkPersonRowHandlers(onToggle)

    handleRowClick()
    handleRowClick()

    expect(onToggle).toHaveBeenCalledTimes(2)
  })

  it('calls onToggle once when checkbox change fires after checkbox click stopPropagation', () => {
    const onToggle = vi.fn()
    const { handleCheckboxClick, handleCheckboxChange } = createSmsBulkPersonRowHandlers(onToggle)
    const stopPropagation = vi.fn()
    const event = { stopPropagation } as unknown as MouseEvent<HTMLInputElement>

    handleCheckboxClick(event)
    handleCheckboxChange()

    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('does not call onToggle when row is disabled', () => {
    const onToggle = vi.fn()
    const { handleRowClick, handleCheckboxChange, handleRowKeyDown } = createSmsBulkPersonRowHandlers(
      onToggle,
      true,
    )

    handleRowClick()
    handleCheckboxChange()
    handleRowKeyDown({
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent<HTMLDivElement>)

    expect(onToggle).not.toHaveBeenCalled()
  })

  it('calls onToggle on Enter or Space keydown', () => {
    const onToggle = vi.fn()
    const { handleRowKeyDown } = createSmsBulkPersonRowHandlers(onToggle)
    const preventDefault = vi.fn()

    handleRowKeyDown({
      key: 'Enter',
      preventDefault,
    } as unknown as KeyboardEvent<HTMLDivElement>)
    handleRowKeyDown({
      key: ' ',
      preventDefault,
    } as unknown as KeyboardEvent<HTMLDivElement>)

    expect(onToggle).toHaveBeenCalledTimes(2)
    expect(preventDefault).toHaveBeenCalledTimes(2)
  })
})
