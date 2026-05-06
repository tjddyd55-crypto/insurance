import type { FormEvent } from 'react'
import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import FormSelect from '../../../../components/form/FormSelect'
import type { PlatformTenantRow } from '../../platformAdmin.types'

const TENANT_STATUS_OPTIONS = [
  { value: 'active', label: 'active' },
  { value: 'inactive', label: 'inactive' },
] as const

export type IndustryDetailTenantSectionsProps = {
  variant: 'pc' | 'mobile'
  industryRowPresent: boolean
  tenants: PlatformTenantRow[]
  tenantsLoading: boolean
  tenantsError: string | null
  onRetryTenants: () => void
  canCreateTenant: boolean
  industryInactive: boolean
  tenantCreateCode: string
  setTenantCreateCode: (v: string) => void
  tenantCreateName: string
  setTenantCreateName: (v: string) => void
  tenantCreateStatus: 'active' | 'inactive'
  setTenantCreateStatus: (v: 'active' | 'inactive') => void
  tenantCreateLegacyGaId: string
  setTenantCreateLegacyGaId: (v: string) => void
  tenantCreateSubmitting: boolean
  tenantCreateSuccessMessage: string | null
  tenantCreateErrorMessage: string | null
  onTenantCreateSubmit: (e: FormEvent<HTMLFormElement>) => void
  clearTenantCreateFeedback: () => void
}

export function IndustryTenantsListSection({
  variant,
  industryRowPresent,
  tenants,
  tenantsLoading,
  tenantsError,
  onRetryTenants,
}: Pick<
  IndustryDetailTenantSectionsProps,
  'variant' | 'industryRowPresent' | 'tenants' | 'tenantsLoading' | 'tenantsError' | 'onRetryTenants'
>) {
  if (!industryRowPresent) {
    return null
  }

  const titleClass =
    variant === 'pc' ? 'platform-admin-page__subhead' : 'platform-admin-page__stack-title'
  const titleId = variant === 'pc' ? 'tenants-list-heading' : 'm-tenants-list'

  return (
    <section
      className={
        variant === 'pc'
          ? 'platform-admin-page__table-wrap platform-admin-page__table-wrap--wide'
          : undefined
      }
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className={titleClass}>
        Tenant 목록
      </h2>
      {tenantsError ? (
        <div className="platform-admin-page__panel platform-admin-page__panel--error" role="alert">
          <p>{tenantsError}</p>
          <button type="button" className="platform-admin-page__btn" onClick={() => void onRetryTenants()}>
            다시 시도
          </button>
        </div>
      ) : null}
      {tenantsLoading ? <p className="platform-admin-page__muted">Tenant 목록을 불러오는 중…</p> : null}
      {variant === 'pc' && !tenantsLoading && !tenantsError ? (
        <table className="platform-admin-page__table platform-admin-page__table--compact">
          <thead>
            <tr>
              <th>id</th>
              <th>code</th>
              <th>name</th>
              <th>status</th>
              <th>legacyGaId</th>
              <th>createdAt</th>
              <th>updatedAt</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((row) => (
              <tr key={row.id}>
                <td className="platform-admin-page__mono">{row.id}</td>
                <td className="platform-admin-page__mono">{row.code}</td>
                <td>{row.name}</td>
                <td>{row.status}</td>
                <td className="platform-admin-page__mono">{row.legacyGaId ?? '—'}</td>
                <td className="platform-admin-page__muted">{row.createdAt ?? '—'}</td>
                <td className="platform-admin-page__muted">{row.updatedAt ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {variant === 'mobile' && !tenantsLoading && !tenantsError ? (
        <ul className="platform-admin-page__card-list">
          {tenants.map((row) => (
            <li key={row.id} className="platform-admin-page__stack-card">
              <div className="platform-admin-page__stack-title">{row.name}</div>
              <div className="platform-admin-page__stack-meta platform-admin-page__mono">{row.code}</div>
              <div className="platform-admin-page__stack-meta">
                id {row.id} · status {row.status}
              </div>
              <div className="platform-admin-page__stack-meta platform-admin-page__mono">
                legacyGaId {row.legacyGaId ?? '—'}
              </div>
              <div className="platform-admin-page__stack-meta">
                {row.createdAt ?? '—'} → {row.updatedAt ?? '—'}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {!tenantsLoading && !tenantsError && tenants.length === 0 ? (
        <p className="platform-admin-page__muted">이 업종에 등록된 Tenant 가 없습니다.</p>
      ) : null}
    </section>
  )
}

export function IndustryTenantCreateSection(props: IndustryDetailTenantSectionsProps) {
  const {
    variant,
    industryRowPresent,
    canCreateTenant,
    industryInactive,
    tenantCreateCode,
    setTenantCreateCode,
    tenantCreateName,
    setTenantCreateName,
    tenantCreateStatus,
    setTenantCreateStatus,
    tenantCreateLegacyGaId,
    setTenantCreateLegacyGaId,
    tenantCreateSubmitting,
    tenantCreateSuccessMessage,
    tenantCreateErrorMessage,
    onTenantCreateSubmit,
    clearTenantCreateFeedback,
  } = props

  if (!industryRowPresent) {
    return null
  }

  const titleClass =
    variant === 'pc' ? 'platform-admin-page__subhead' : 'platform-admin-page__stack-title'
  const titleId = variant === 'pc' ? 'tenant-create-heading' : 'm-tenant-create'
  const codeId = variant === 'pc' ? 'platform-tenant-create-code' : 'platform-tenant-create-code-m'
  const nameId = variant === 'pc' ? 'platform-tenant-create-name' : 'platform-tenant-create-name-m'
  const gaId =
    variant === 'pc' ? 'platform-tenant-create-legacy-ga' : 'platform-tenant-create-legacy-ga-m'
  const statusId =
    variant === 'pc' ? 'platform-tenant-create-status' : 'platform-tenant-create-status-m'

  return (
    <section className="platform-admin-page__industry-create" aria-labelledby={titleId}>
      <h2 id={titleId} className={titleClass}>
        Tenant 생성
      </h2>
      {industryInactive ? (
        <p className="platform-admin-page__muted" role="status">
          비활성(inactive) 업종에서는 새 Tenant 를 생성할 수 없습니다.
        </p>
      ) : null}

      {tenantCreateSuccessMessage ? (
        <div className="platform-admin-page__panel platform-admin-page__panel--success" role="status">
          <p>{tenantCreateSuccessMessage}</p>
        </div>
      ) : null}

      {tenantCreateErrorMessage ? (
        <div className="platform-admin-page__panel platform-admin-page__panel--error" role="alert">
          <p>{tenantCreateErrorMessage}</p>
        </div>
      ) : null}

      {canCreateTenant ? (
        <form className="platform-admin-page__industry-create-form" onSubmit={onTenantCreateSubmit}>
          <div className="platform-admin-page__form-field">
            <label className="dark-label" htmlFor={codeId}>
              code <span className="platform-admin-page__required">*</span>
            </label>
            <p className="platform-admin-page__field-hint">
              저장 시 <strong>소문자로 정규화</strong>됩니다. 영문 소문자 또는 숫자로 시작하고, 이후 영문
              소문자·숫자·`_`·`-` 만 허용됩니다 (최대 64자). <code className="platform-admin-page__mono">yjasset</code>{' '}
              은 예약 코드입니다.
            </p>
            <FormInput
              id={codeId}
              name="code"
              autoComplete="off"
              value={tenantCreateCode}
              onChange={(e) => {
                clearTenantCreateFeedback()
                setTenantCreateCode(e.target.value)
              }}
              disabled={tenantCreateSubmitting}
              placeholder="예: acme_insurance"
            />
          </div>

          <div className="platform-admin-page__form-field">
            <label className="dark-label" htmlFor={nameId}>
              name <span className="platform-admin-page__required">*</span>
            </label>
            <p className="platform-admin-page__field-hint">1~200자</p>
            <FormInput
              id={nameId}
              name="name"
              autoComplete="off"
              value={tenantCreateName}
              onChange={(e) => {
                clearTenantCreateFeedback()
                setTenantCreateName(e.target.value)
              }}
              disabled={tenantCreateSubmitting}
            />
          </div>

          <div className="platform-admin-page__form-field">
            <label className="dark-label" htmlFor={statusId}>
              status
            </label>
            <FormSelect
              id={statusId}
              name="status"
              value={tenantCreateStatus}
              disabled={tenantCreateSubmitting}
              options={[...TENANT_STATUS_OPTIONS]}
              onChange={(e) => {
                clearTenantCreateFeedback()
                const v = e.target.value === 'inactive' ? 'inactive' : 'active'
                setTenantCreateStatus(v)
              }}
            />
          </div>

          <div className="platform-admin-page__form-field">
            <label className="dark-label" htmlFor={gaId}>
              legacyGaId (선택)
            </label>
            <p className="platform-admin-page__field-hint">비워 두면 생략됩니다. 입력 시 양의 정수.</p>
            <FormInput
              id={gaId}
              name="legacyGaId"
              autoComplete="off"
              inputMode="numeric"
              value={tenantCreateLegacyGaId}
              onChange={(e) => {
                clearTenantCreateFeedback()
                setTenantCreateLegacyGaId(e.target.value)
              }}
              disabled={tenantCreateSubmitting}
              placeholder=""
            />
          </div>

          <div className="platform-admin-page__form-actions">
            <FormButton
              htmlType="submit"
              variant="primary"
              loading={tenantCreateSubmitting}
              loadingText="생성 중…"
              disabled={tenantCreateSubmitting}
              fullWidth={variant === 'mobile'}
            >
              Tenant 생성
            </FormButton>
          </div>
        </form>
      ) : (
        !industryInactive ? (
          <p className="platform-admin-page__muted">업종 정보를 불러온 뒤 Tenant 를 생성할 수 있습니다.</p>
        ) : null
      )}
    </section>
  )
}
