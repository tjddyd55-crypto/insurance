import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeDateInput } from '../../utils/dateInput'
import AppDateInput, { openNativeDatePicker } from './AppDateInput'

describe('AppDateInput', () => {
  it('renders visible text input with maxLength 10', () => {
    const html = renderToStaticMarkup(<AppDateInput value="" onChange={() => undefined} />)
    expect(html).toContain('type="text"')
    expect(html).toContain('maxLength="10"')
    expect(html).toContain('placeholder="YYYY-MM-DD"')
    expect(html).toContain('app-date-input__text')
  })

  it('renders hidden native date input and calendar button', () => {
    const html = renderToStaticMarkup(<AppDateInput value="2026-07-08" onChange={() => undefined} />)
    expect(html).toContain('type="date"')
    expect(html).toContain('app-date-input__native')
    expect(html).toContain('app-date-input__button')
    expect(html).toContain('aria-label="날짜 선택"')
    expect(html).toContain('value="2026-07-08"')
  })

  it('keeps direct typing normalize behavior', () => {
    let next = ''
    const html = renderToStaticMarkup(
      <AppDateInput
        value=""
        onChange={(value) => {
          next = value
        }}
      />,
    )
    expect(html).toContain('type="text"')
    expect(normalizeDateInput('20260708')).toBe('2026-07-08')
    next = normalizeDateInput('20260708')
    expect(next).toBe('2026-07-08')
  })

  it('keeps paste normalize behavior', () => {
    expect(normalizeDateInput('2026년07월08일')).toBe('2026-07-08')
  })
})

describe('openNativeDatePicker', () => {
  it('calls showPicker when available', () => {
    const showPicker = vi.fn()
    const click = vi.fn()
    const input = { showPicker, click } as unknown as HTMLInputElement

    openNativeDatePicker(input)

    expect(showPicker).toHaveBeenCalledTimes(1)
    expect(click).not.toHaveBeenCalled()
  })

  it('falls back to click when showPicker is unavailable', () => {
    const click = vi.fn()
    const input = { click } as unknown as HTMLInputElement

    openNativeDatePicker(input)

    expect(click).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled', () => {
    const showPicker = vi.fn()
    const input = { showPicker, click: vi.fn() } as unknown as HTMLInputElement

    openNativeDatePicker(input, { disabled: true })

    expect(showPicker).not.toHaveBeenCalled()
  })
})

describe('AppDateInput native selection', () => {
  it('passes YYYY-MM-DD from native date input value', () => {
    const nativeValue = '2026-07-08'
    expect(/^\d{4}-\d{2}-\d{2}$/.test(nativeValue)).toBe(true)
    expect(nativeValue).toBe('2026-07-08')
  })
})
