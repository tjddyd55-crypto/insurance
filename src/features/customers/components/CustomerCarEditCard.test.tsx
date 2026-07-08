import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CustomerCarEditCard } from './CustomerCarEditCard'

describe('CustomerCarEditCard', () => {
  it('renders car year as numeric text input capped at 4 digits', () => {
    const html = renderToStaticMarkup(
      <CustomerCarEditCard
        index={0}
        car={{
          carNumber: '',
          carModel: '',
          carYear: '2026',
          renewalDate: '2026-07-08',
          isPrimary: true,
        }}
        canRemove={false}
        onChange={() => undefined}
        onRemove={() => undefined}
      />,
    )
    expect(html).toContain('maxLength="4"')
    expect(html).toContain('inputMode="numeric"')
    expect(html).toContain('value="2026"')
  })

  it('passes partial renewal date through AppDateInput without coercion', () => {
    const html = renderToStaticMarkup(
      <CustomerCarEditCard
        index={0}
        car={{
          carNumber: '',
          carModel: '',
          carYear: '',
          renewalDate: '2026-07',
          isPrimary: true,
        }}
        canRemove={false}
        onChange={() => undefined}
        onRemove={() => undefined}
      />,
    )
    expect(html).toContain('value="2026-07"')
    expect(html).toContain('app-date-input__button')
  })
})
