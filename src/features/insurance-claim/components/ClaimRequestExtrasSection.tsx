import { useState } from 'react'
import { FormButton } from '../../../components/form'
import { SignatureModal } from '../../consent/components/SignatureModal'
import '../../consent/consent.css'
import type {
  ClaimAttachmentMetadata,
  ClaimSignatureData,
  CustomerClaimAppAttachment,
} from '../api/claimRequestsApi'

type SignatureRole = 'insured' | 'contractor'

type Props = {
  customerId: number | null
  draftSaved: boolean
  additionalAttachments: ClaimAttachmentMetadata[]
  selectedCustomerAttachmentIds: number[]
  customerAttachments: CustomerClaimAppAttachment[]
  customerAttachmentsLoading: boolean
  signatureData: ClaimSignatureData
  contractorSameAsInsured: boolean
  uploadingAttachment: boolean
  uploadingSignatureRole: SignatureRole | null
  onUploadAttachment: (file: File) => void
  onRemoveAttachment: (storageKey: string) => void
  onToggleCustomerAttachment: (id: number, checked: boolean) => void
  onSaveSignature: (role: SignatureRole, pngBlob: Blob) => Promise<void>
  onClearSignature: (role: SignatureRole) => void
  sectionsStartAt?: number
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '—'
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`
  return `${(size / (1024 * 1024)).toFixed(1)}MB`
}

function formatDate(raw: string | null) {
  if (!raw) return '—'
  return String(raw).slice(0, 10)
}

function SignatureBlock({
  title,
  role,
  signature,
  busy,
  onOpen,
  onClear,
}: {
  title: string
  role: SignatureRole
  signature: ClaimSignatureData['insuredSignature']
  busy: boolean
  onOpen: (role: SignatureRole) => void
  onClear: (role: SignatureRole) => void
}) {
  const hasSignature = signature != null && String(signature.storageKey ?? '').trim() !== ''

  return (
    <div className="insurance-claim-form__signature-block">
      <h3>{title}</h3>
      {hasSignature ? (
        <p className="insurance-claim-form__meta">
          <span className="insurance-claim-form__signature-status">서명 완료</span>
          <span className="insurance-claim-form__hint">
            {formatDate(signature?.signedAt ?? null)}
          </span>
        </p>
      ) : (
        <p className="insurance-claim-form__hint">서명이 없습니다.</p>
      )}
      <div className="insurance-claim-form__signature-actions">
        <FormButton htmlType="button" variant="primary" size="sm" disabled={busy} onClick={() => onOpen(role)}>
          {hasSignature ? '재작성' : '서명 작성'}
        </FormButton>
        {hasSignature ? (
          <FormButton htmlType="button" variant="secondary" size="sm" disabled={busy} onClick={() => onClear(role)}>
            지우기
          </FormButton>
        ) : null}
      </div>
    </div>
  )
}

export default function ClaimRequestExtrasSection({
  customerId,
  draftSaved,
  additionalAttachments,
  selectedCustomerAttachmentIds,
  customerAttachments,
  customerAttachmentsLoading,
  signatureData,
  contractorSameAsInsured,
  uploadingAttachment,
  uploadingSignatureRole,
  onUploadAttachment,
  onRemoveAttachment,
  onToggleCustomerAttachment,
  onSaveSignature,
  onClearSignature,
  sectionsStartAt = 5,
}: Props) {
  const [signatureModalRole, setSignatureModalRole] = useState<SignatureRole | null>(null)

  return (
    <>
      <section className="insurance-claim-form__section claim-form-section">
        <h2>{sectionsStartAt}. 서명</h2>
        {!draftSaved ? (
          <p className="insurance-claim-form__hint">청구 초안을 먼저 저장한 뒤 서명을 작성할 수 있습니다.</p>
        ) : (
          <div className="insurance-claim-form__signature-grid">
            <SignatureBlock
              title="피보험자 서명"
              role="insured"
              signature={signatureData.insuredSignature}
              busy={uploadingSignatureRole === 'insured'}
              onOpen={setSignatureModalRole}
              onClear={onClearSignature}
            />
            {!contractorSameAsInsured ? (
              <SignatureBlock
                title="계약자 서명"
                role="contractor"
                signature={signatureData.contractorSignature}
                busy={uploadingSignatureRole === 'contractor'}
                onOpen={setSignatureModalRole}
                onClear={onClearSignature}
              />
            ) : null}
          </div>
        )}
      </section>

      <section className="insurance-claim-form__section claim-form-section">
        <h2>{sectionsStartAt + 1}. 추가 첨부파일</h2>
        {!draftSaved ? (
          <p className="insurance-claim-form__hint">청구 초안을 먼저 저장한 뒤 첨부파일을 추가할 수 있습니다.</p>
        ) : (
          <>
            <label className="insurance-claim-form__upload">
              <span>파일 추가</span>
              <input
                type="file"
                disabled={uploadingAttachment}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) onUploadAttachment(file)
                }}
              />
            </label>
            {additionalAttachments.length === 0 ? (
              <p className="insurance-claim-form__hint">추가된 첨부파일이 없습니다.</p>
            ) : (
              <ul className="insurance-claim-form__file-list">
                {additionalAttachments.map((file) => (
                  <li key={file.storageKey}>
                    <span>
                      {file.fileName} ({formatBytes(file.size)})
                    </span>
                    <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => onRemoveAttachment(file.storageKey)}>
                      삭제
                    </FormButton>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="insurance-claim-form__section claim-form-section">
        <h2>{sectionsStartAt + 2}. 고객앱 첨부파일</h2>
        {customerId == null ? (
          <p className="insurance-claim-form__hint">고객을 불러오면 고객앱 첨부파일을 선택할 수 있습니다.</p>
        ) : customerAttachmentsLoading ? (
          <p className="insurance-claim-form__hint">고객앱 첨부파일을 불러오는 중…</p>
        ) : customerAttachments.length === 0 ? (
          <p className="insurance-claim-form__hint">선택 가능한 고객앱 첨부파일이 없습니다.</p>
        ) : (
          <ul className="insurance-claim-form__check-list">
            {customerAttachments.map((file) => (
              <li key={file.id}>
                <label className="insurance-claim-form__check-item">
                  <input
                    type="checkbox"
                    checked={selectedCustomerAttachmentIds.includes(file.id)}
                    onChange={(event) => onToggleCustomerAttachment(file.id, event.target.checked)}
                  />
                  <span>
                    {file.fileName} · {formatBytes(file.fileSize)} · {formatDate(file.uploadedAt)} · {file.requestTitle}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SignatureModal
        open={signatureModalRole != null}
        title={signatureModalRole === 'contractor' ? '계약자 서명' : '피보험자 서명'}
        description="마우스 또는 손가락으로 서명해 주세요."
        saveLabel="저장"
        padResetKey={signatureModalRole ?? undefined}
        onClose={() => setSignatureModalRole(null)}
        onSave={async (pngBlob) => {
          if (signatureModalRole == null) {
            return
          }
          await onSaveSignature(signatureModalRole, pngBlob)
        }}
      />
    </>
  )
}
