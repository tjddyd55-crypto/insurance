import { inferAdvisorContactType, type AdvisorContactType } from '../utils/advisorContactLink'

export type CustomContactDraft = {
  id: string
  label: string
  value: string
  contactType: AdvisorContactType
  isVisible: boolean
}

const CONTACT_TYPE_OPTIONS: AdvisorContactType[] = ['phone', 'email', 'url', 'text']

type Props = {
  items: CustomContactDraft[]
  max: number
  onChange: (items: CustomContactDraft[]) => void
}

function newDraft(): CustomContactDraft {
  return {
    id: `draft-${crypto.randomUUID()}`,
    label: '',
    value: '',
    contactType: 'url',
    isVisible: true,
  }
}

export function AdvisorCustomContactsEditor({ items, max, onChange }: Props) {
  const add = () => {
    if (items.length >= max) return
    onChange([...items, newDraft()])
  }

  const update = (id: string, patch: Partial<CustomContactDraft>) => {
    onChange(items.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const remove = (id: string) => {
    onChange(items.filter((row) => row.id !== id))
  }

  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((r) => r.id === id)
    if (idx < 0) return
    const next = idx + dir
    if (next < 0 || next >= items.length) return
    const copy = [...items]
    const [row] = copy.splice(idx, 1)
    copy.splice(next, 0, row)
    onChange(copy)
  }

  return (
    <div className="pap-custom-contacts-editor">
      {items.map((row, index) => (
        <div key={row.id} className="pap-custom-contacts-editor__row">
          <label>
            라벨
            <input
              value={row.label}
              onChange={(e) => update(row.id, { label: e.target.value })}
              placeholder="인스타그램"
              maxLength={80}
            />
          </label>
          <label>
            내용
            <input
              value={row.value}
              onChange={(e) => {
                const value = e.target.value
                update(row.id, { value, contactType: inferAdvisorContactType(value) })
              }}
              placeholder="https://..."
              maxLength={500}
            />
          </label>
          <label>
            유형
            <select
              value={row.contactType}
              onChange={(e) => update(row.id, { contactType: e.target.value as AdvisorContactType })}
            >
              {CONTACT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <div className="pap-custom-contacts-editor__actions">
            <button type="button" className="pap-btn pap-btn--secondary" disabled={index === 0} onClick={() => move(row.id, -1)}>↑</button>
            <button type="button" className="pap-btn pap-btn--secondary" disabled={index === items.length - 1} onClick={() => move(row.id, 1)}>↓</button>
            <button type="button" className="pap-btn pap-btn--secondary" onClick={() => update(row.id, { isVisible: !row.isVisible })}>
              {row.isVisible ? '비노출' : '노출'}
            </button>
            <button type="button" className="pap-btn pap-btn--secondary" onClick={() => remove(row.id)}>삭제</button>
          </div>
        </div>
      ))}
      <button type="button" className="pap-btn pap-btn--secondary" disabled={items.length >= max} onClick={add}>
        + 추가정보 추가
      </button>
    </div>
  )
}
