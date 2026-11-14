import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((match) => /cursor:\s*[^;]+;/.test(match[2]))
const cursorForSelector = (selector: string) => rules
  .filter((rule) => rule[1].split(',\n').some((part) => part.trim() === selector))
  .map((rule) => rule[2].match(/cursor:\s*([^;]+);/)?.[1])
  .at(-1)

describe('shared web date cursor CSS contract', () => {
  it.each(['date', 'time', 'datetime-local', 'month', 'week'])('covers enabled %s inputs without requiring a page or form class', (type) => {
    const selector = `input[type='${type}']:not(:disabled):not([readonly])`
    expect(cursorForSelector(selector)).toBe('pointer')
    expect(cursorForSelector(`${selector}::-webkit-calendar-picker-indicator`)).toBe('pointer')
  })

  it('keeps editable date text and the calendar button distinct', () => {
    expect(cursorForSelector('.app-date-input__text:not(:disabled):not([readonly])')).toBe('text')
    expect(cursorForSelector('.app-date-input__button')).toBe('pointer')
    expect(cursorForSelector('.app-date-input__button:disabled')).toBe('not-allowed')
  })

  it('keeps native locked controls and their Chromium subcontrols not-allowed', () => {
    const selector = "input:is([type='date'], [type='time'], [type='datetime-local'], [type='month'], [type='week']):is(:disabled, [readonly])"
    for (const suffix of ['', '::-webkit-calendar-picker-indicator', '::-webkit-datetime-edit']) {
      expect(cursorForSelector(selector + suffix)).toBe('not-allowed')
    }
  })

  it('never uses the broad :read-only pseudo-class to assign a forbidden cursor', () => {
    for (const rule of rules) {
      if (/cursor:\s*not-allowed/.test(rule[2])) expect(rule[1]).not.toContain(':read-only')
    }
  })
})
