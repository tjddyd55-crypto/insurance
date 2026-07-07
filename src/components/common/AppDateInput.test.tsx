import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AppDateInput from './AppDateInput'

describe('AppDateInput', () => {
  it('renders text input with maxLength 10', () => {
    const html = renderToStaticMarkup(<AppDateInput value="" onChange={() => undefined} />)
    expect(html).toContain('type="text"')
    expect(html).toContain('maxLength="10"')
    expect(html).toContain('placeholder="YYYY-MM-DD"')
  })
})
