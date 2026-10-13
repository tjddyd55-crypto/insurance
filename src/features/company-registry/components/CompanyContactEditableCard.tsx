import { useMemo } from 'react'
import { FormButton, FormInput, FormSelect } from '../../../components/form'
import type { InsurerSite } from '../../insurer-sites/api/insurerSitesApi'
import { formatPhoneNumber } from '../../contacts/utils/phone'
import type { ContactCompanyCardDraft, ContactPersonDraft } from '../domain/contactCardWorkspaceModel'
import { applyNewCardCategoryChange, emptyContactRow } from '../domain/contactCardWorkspaceModel'
import { buildInsuranceCompanyPickerOptions } from '../domain/insuranceCompanyCatalogOptions'
import type { CompanyDirectoryEntry } from '../domain/types'
import { INSURANCE_TYPE_LABELS, INSURANCE_TYPE_ORDER, type InsuranceCategory } from '../domain/insuranceConstants'
type CompanyContactEditableCardProps = {
  draft: ContactCompanyCardDraft
  directory: CompanyDirectoryEntry[]
  insurerCatalog: InsurerSite[]
  editingTab: InsuranceCategory
  onChange: (next: ContactCompanyCardDraft) => void
  onRemoveCard: () => void
}

export function CompanyContactEditableCard({
  draft,
  directory,
  insurerCatalog,
  editingTab,
  onChange,
  onRemoveCard,
}: CompanyContactEditableCardProps) {
  const crossTabEdit = draft.category !== editingTab
  const companyOptions = useMemo(
    () => buildInsuranceCompanyPickerOptions(directory, insurerCatalog, draft.category),
    [directory, draft.category, insurerCatalog],
  )
  if (draft.markedForDeletion) {
    return (
      <article className="company-card company-card--editing company-card--marked-delete">
        <div className="company-card__header">
          <h3 className="company-card__title">{draft.companyName || '보험회사'}</h3>
          <span className="company-card__delete-badge">삭제 예정</span>
        </div>
        <p className="company-card__delete-hint">저장하면 이 보험사 카드의 담당자 연락처가 제거됩니다.</p>
        <FormButton variant="secondary" size="sm" onClick={() => onChange({ ...draft, markedForDeletion: false })}>
          삭제 취소
        </FormButton>
      </article>
    )
  }

  const updateContact = (rowKey: string, patch: Partial<ContactPersonDraft>) => {
    onChange({
      ...draft,
      contacts: draft.contacts.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row)),
    })
  }

  const removeContact = (rowKey: string) => {
    const next = draft.contacts.filter((row) => row.rowKey !== rowKey)
    onChange({
      ...draft,
      contacts: next.length ? next : [emptyContactRow()],
    })
  }

  const addContact = () => {
    onChange({ ...draft, contacts: [...draft.contacts, emptyContactRow()] })
  }

  return (
    <article
      className={`company-card company-card--editing${crossTabEdit ? ' company-card--edit-cross-tab' : ''}`}
    >
      <div className="company-card__header">
        {draft.isNew ? (
          <div className="company-card__new-meta">
            {crossTabEdit ? (
              <p className="company-card__cross-tab-hint" role="status">
                {INSURANCE_TYPE_LABELS[draft.category]} 카드 — 저장 후 「{INSURANCE_TYPE_LABELS[draft.category]}」 탭에서
                조회됩니다.
              </p>
            ) : null}
            <FormSelect
              className="field__control company-card__category-select"
              value={draft.category}
              onChange={(event) => {
                const category = event.target.value as InsuranceCategory
                onChange(applyNewCardCategoryChange(draft, category))
              }}
              options={INSURANCE_TYPE_ORDER.map((value) => ({
                value,
                label: INSURANCE_TYPE_LABELS[value],
              }))}
            />
            <FormSelect
              className="field__control company-card__company-select"
              value={draft.companyCode}
              onChange={(event) => {
                const companyCode = String(event.target.value ?? '')
                const option = companyOptions.find((row) => row.companyCode === companyCode)
                onChange({
                  ...draft,
                  companyCode,
                  companyName: option?.name ?? '',
                  customerCenter: option?.tel ?? draft.customerCenter,
                })
              }}
              options={[
                { value: '', label: '보험회사 선택' },
                ...companyOptions.map((row) => ({ value: row.companyCode, label: row.name })),
              ]}
            />
          </div>
        ) : (
          <h3 className="company-card__title">{draft.companyName}</h3>
        )}
        <FormButton
          variant="action"
          size="sm"
          className="company-card__remove"
          onClick={onRemoveCard}
          aria-label="보험회사 카드 삭제"
        >
          삭제
        </FormButton>
      </div>

      <div className="company-contacts-block company-contacts-block--editing">
        {draft.contacts.map((person) => (
          <div key={person.rowKey} className="contact-row contact-row--editing">
            <FormInput
              className="field__control contact-row__input"
              placeholder="담당자명"
              value={person.name}
              onChange={(event) => updateContact(person.rowKey, { name: event.target.value })}
            />
            <FormInput
              className="field__control contact-row__input"
              placeholder="직책"
              value={person.position}
              onChange={(event) => updateContact(person.rowKey, { position: event.target.value })}
            />
            <FormInput
              className="field__control contact-row__input"
              placeholder="전화번호"
              format="phone"
              value={person.phone}
              onChange={(event) => updateContact(person.rowKey, { phone: event.target.value })}
            />
            <FormButton
              variant="action"
              size="sm"
              className="contact-row__remove"
              onClick={() => removeContact(person.rowKey)}
              aria-label="담당자 삭제"
            >
              ×
            </FormButton>
          </div>
        ))}
      </div>

      <FormButton variant="secondary" size="sm" className="company-card__add-contact" onClick={addContact}>
        + 담당자 추가
      </FormButton>

      {!draft.isNew && draft.contacts.some((row) => row.phone.trim()) ? (
        <p className="company-card__preview-hint visually-hidden" aria-hidden="true">
          {draft.contacts.map((row) => formatPhoneNumber(row.phone)).join(', ')}
        </p>
      ) : null}
    </article>
  )
}
