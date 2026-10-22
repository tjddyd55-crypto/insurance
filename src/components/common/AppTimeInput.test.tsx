/**
 * @vitest-environment jsdom
 */
import { act, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import AppTimeInput from './AppTimeInput'

const g = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
g.IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let host: HTMLDivElement | null = null

function mount(ui: ReactElement): HTMLDivElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => {
    root!.render(ui)
  })
  return host
}

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('AppTimeInput', () => {
  it('shows 오전/오후 on the closed field and hides the 24-hour native time input', () => {
    const view = mount(<AppTimeInput ariaLabel="시작 시간" value="09:00" onChange={() => undefined} />)
    const display = view.querySelector('input[aria-label="시작 시간"]') as HTMLInputElement
    expect(display.value).toBe('오전 9:00')
    expect(display.readOnly).toBe(true)
    expect(view.querySelector('input[type="time"]')).toBeNull()
    expect(document.body.querySelector('[aria-label="시간 선택"]')).toBeNull()
  })

  it('opens 시·분·오전/오후 and writes HH:mm when the meridiem changes', () => {
    const seen: string[] = []
    const view = mount(<AppTimeInput ariaLabel="종료 시간" value="09:00" onChange={(next) => seen.push(next)} />)
    const display = view.querySelector('input[aria-label="종료 시간"]') as HTMLInputElement
    act(() => {
      display.click()
    })
    expect(document.body.querySelector('[aria-label="시간 선택"]')).not.toBeNull()
    const afternoon = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === '오후')
    act(() => {
      afternoon?.click()
    })
    expect(seen).toEqual(['21:00'])
  })

  it('accepts keyboard hour and minute and keeps the stored clock in 24-hour form', () => {
    const seen: string[] = []
    const view = mount(<AppTimeInput ariaLabel="시작 시간" value="13:00" onChange={(next) => seen.push(next)} />)
    act(() => {
      ;(view.querySelector('input[aria-label="시작 시간"]') as HTMLInputElement).click()
    })
    setInputValue(document.body.querySelector('input[aria-label="시"]') as HTMLInputElement, '2')
    setInputValue(document.body.querySelector('input[aria-label="분"]') as HTMLInputElement, '45')
    expect(seen).toEqual(['14:00', '14:45'])
  })

  it('keeps the typed hour and minute when 오후 is chosen', () => {
    function Harness() {
      const [value, setValue] = useState('09:00')
      return <AppTimeInput ariaLabel="시작 시간" value={value} onChange={setValue} />
    }
    const view = mount(<Harness />)
    act(() => {
      ;(view.querySelector('input[aria-label="시작 시간"]') as HTMLInputElement).click()
    })
    setInputValue(document.body.querySelector('input[aria-label="시"]') as HTMLInputElement, '2')
    setInputValue(document.body.querySelector('input[aria-label="분"]') as HTMLInputElement, '30')
    act(() => {
      Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === '오후')?.click()
    })
    const display = view.querySelector('input[aria-label="시작 시간"]') as HTMLInputElement
    expect(display.value).toBe('오후 2:30')
  })
})
