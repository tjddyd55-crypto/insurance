import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SmsBulkPersonRow from './SmsBulkPersonRow'

const renderRow = (gender: 'male' | 'female' | null, birthDate: string | null, genderLabel = '') =>
  renderToStaticMarkup(<SmsBulkPersonRow
    name="AI테스트_홍길동"
    gender={gender}
    genderLabel={genderLabel}
    birthDate={birthDate}
    phoneDisplay="010-****-****"
    checked={false}
    onCheckChange={() => {}}
  />)

describe('SmsBulkPersonRow', () => {
  it.each([['male', '남'], ['female', '여']] as const)('shows %s and birth year together below the name', (gender, label) => {
    const markup = renderRow(gender, '1990-05-12')
    expect(markup).toContain('sms-bulk-person-row__name">AI테스트_홍길동</span>')
    expect(markup).toContain(`sms-bulk-person-row__meta">${label} · 1990년생</span>`)
    expect(markup).toContain('sms-bulk-person-row__phone">010-****-****</span>')
    expect(markup).not.toContain('1990-05-12')
  })

  it('keeps missing fields readable and uses the gender label fallback', () => {
    expect(renderRow(null, null)).toContain('sms-bulk-person-row__meta">- · -</span>')
    expect(renderRow(null, '1990-05-12', '여')).toContain('여 · 1990년생')
    expect(renderRow('male', null)).toContain('남 · -')
  })
})
