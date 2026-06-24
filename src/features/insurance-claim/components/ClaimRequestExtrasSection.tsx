import { FormButton } from '../../../components/form'
import type {
  ClaimAttachmentMetadata,
  ClaimSignatureData,
  CustomerClaimAppAttachment,
} from '../api/claimRequestsApi'

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
  uploadingSignatureRole: 'insured' | 'contractor' | null
  onUploadAttachment: (file: File) => void
  onRemoveAttachment: (storageKey: string) => void
  onToggleCustomerAttachment: (id: number, checked: boolean) => void
  onUploadSignature: (role: 'insured' | 'contractor', file: File) => void
  onClearSignature: (role: 'insured' | 'contractor') => void
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '—'
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`
  return `${(size / (1024 * 1024)).toFixed(1)}MB`
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
  onUploadSignature,
  onClearSignature,
}: Props) {
  return (
    <>
      <section className="insurance-claim-form__section">
        <h2>7. 추가 첨부파일</h2>
        {!draftSaved ? (
          <p className="insurance-claim-form__hint">청구 초안을 먼저 저장한 뒤 첨부파일을 추가할 수 있습니다.</p>
        ) : (
          <>
            <label className="insurance-claim-form__upload">
              <span>파일 선택</span>
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
                    <FormButton htmlType="button" variant="secondary" onClick={() => onRemoveAttachment(file.storageKey)}>
                      삭제
                    </FormButton>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="insurance-claim-form__section">
        <h2>8. 고객앱 첨부파일</h2>
        {customerId == null ? (
          <p className="insurance-claim-form__hint">고객이 연결된 청구에서만 고객앱 첨부파일을 선택할 수 있습니다.</p>
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
                    {file.fileName} · {file.requestTitle} · {String(file.uploadedAt ?? '').slice(0, 10)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="insurance-claim-form__section">
        <h2>9. 서명</h2>
        {!draftSaved ? (
          <p className="insurance-claim-form__hint">청구 초안을 먼저 저장한 뒤 서명 파일을 업로드할 수 있습니다.</p>
        ) : (
          <div className="insurance-claim-form__signature-grid">
            <div>
              <h3>피보험자 서명</h3>
              <label className="insurance-claim-form__upload">
                <span>이미지 선택</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploadingSignatureRole === 'insured'}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) onUploadSignature('insured', file)
                  }}
                />
              </label>
              {signatureData.insuredSignature ? (
                <p className="insurance-claim-form__meta">
                  {signatureData.insuredSignature.fileName}
                  <FormButton htmlType="button" variant="secondary" onClick={() => onClearSignature('insured')}>
                    삭제
                  </FormButton>
                </p>
              ) : (
                <p className="insurance-claim-form__hint">업로드된 서명이 없습니다.</p>
              )}
            </div>
            {!contractorSameAsInsured ? (
              <div>
                <h3>계약자 서명</h3>
                <label className="insurance-claim-form__upload">
                  <span>이미지 선택</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploadingSignatureRole === 'contractor'}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file) onUploadSignature('contractor', file)
                    }}
                  />
                </label>
                {signatureData.contractorSignature ? (
                  <p className="insurance-claim-form__meta">
                    {signatureData.contractorSignature.fileName}
                    <FormButton htmlType="button" variant="secondary" onClick={() => onClearSignature('contractor')}>
                      삭제
                    </FormButton>
                  </p>
                ) : (
                  <p className="insurance-claim-form__hint">업로드된 서명이 없습니다.</p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </>
  )
}
