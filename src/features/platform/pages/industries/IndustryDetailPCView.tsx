import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import type { IndustryDetailViewProps } from './IndustryDetailPage'
import { IndustryTenantCreateSection, IndustryTenantsListSection } from './IndustryDetailTenantSections'

export default function IndustryDetailPCView({
  industryIdRaw,
  industryParamInvalid,
  industriesLoading,
  industriesError,
  industryRow,
  industryMissingFromList,
  admins,
  adminsLoading,
  adminsError,
  assignUserId,
  setAssignUserId,
  assignSubmitting,
  assignSuccessMessage,
  assignErrorMessage,
  reload,
  onAssignSubmit,
  clearAssignFeedback,
  tenantsForIndustry,
  tenantsLoading,
  tenantsError,
  refetchTenants,
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
}: IndustryDetailViewProps) {
  const canAssign = Boolean(industryRow) && !industriesLoading && !industriesError
  const tenantSectionProps = {
    variant: 'pc' as const,
    industryRowPresent: Boolean(industryRow),
    tenants: tenantsForIndustry,
    tenantsLoading,
    tenantsError,
    onRetryTenants: refetchTenants,
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
  }

  return (
    <main className="page platform-industry-detail-page platform-admin-page platform-industry-detail-page--pc platform-admin-page--pc page--with-back">
      <header className="platform-admin-page__head">
        <h1 className="platform-admin-page__title">Industry 관리</h1>
        <p className="platform-admin-page__lede">
          업종 <span className="platform-admin-page__mono">{industryIdRaw || '—'}</span> · Industry Admin 및 Tenant ·
          Super Admin 또는 해당 Industry Admin
        </p>
      </header>

      {industryParamInvalid ? (
        <div className="platform-admin-page__panel platform-admin-page__panel--error" role="alert">
          <p>유효한 industry id가 필요합니다.</p>
        </div>
      ) : null}

      {industriesLoading ? <p className="platform-admin-page__muted">업종 정보를 불러오는 중…</p> : null}

      {industriesError ? (
        <div className="platform-admin-page__panel platform-admin-page__panel--error" role="alert">
          <p>{industriesError}</p>
          <button type="button" className="platform-admin-page__btn" onClick={() => void reload()}>
            다시 시도
          </button>
        </div>
      ) : null}

      {industryMissingFromList ? (
        <div className="platform-admin-page__panel platform-admin-page__panel--warn" role="status">
          <p>업종을 찾을 수 없습니다.</p>
        </div>
      ) : null}

      {industryRow ? (
        <section className="platform-admin-page__summary-grid" aria-labelledby="industry-summary-heading">
          <h2 id="industry-summary-heading" className="platform-admin-page__subhead">
            Industry 요약
          </h2>
          <div className="platform-admin-page__summary-card">
            <dl className="platform-admin-page__dl">
              <dt>id</dt>
              <dd className="platform-admin-page__mono">{industryRow.id}</dd>
              <dt>code</dt>
              <dd>{industryRow.code}</dd>
              <dt>name</dt>
              <dd>{industryRow.name}</dd>
              <dt>status</dt>
              <dd>{industryRow.status}</dd>
              <dt>createdAt</dt>
              <dd className="platform-admin-page__mono">{industryRow.createdAt ?? '—'}</dd>
              <dt>updatedAt</dt>
              <dd className="platform-admin-page__mono">{industryRow.updatedAt ?? '—'}</dd>
            </dl>
          </div>
        </section>
      ) : null}

      <section className="platform-admin-page__table-wrap platform-admin-page__table-wrap--wide" aria-labelledby="admins-heading">
        <h2 id="admins-heading" className="platform-admin-page__subhead">
          Industry Admin 목록
        </h2>
        {adminsError ? (
          <div className="platform-admin-page__panel platform-admin-page__panel--error" role="alert">
            <p>{adminsError}</p>
            <button type="button" className="platform-admin-page__btn" onClick={() => void reload()}>
              다시 시도
            </button>
          </div>
        ) : null}
        {adminsLoading ? <p className="platform-admin-page__muted">목록을 불러오는 중…</p> : null}
        {!adminsLoading && !adminsError && industryRow ? (
          <table className="platform-admin-page__table platform-admin-page__table--compact">
            <thead>
              <tr>
                <th>membershipId</th>
                <th>userId</th>
                <th>username</th>
                <th>legacyRole</th>
                <th>membershipRole</th>
                <th>status</th>
                <th>createdAt</th>
                <th>updatedAt</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((row) => (
                <tr key={row.membershipId}>
                  <td className="platform-admin-page__mono">{row.membershipId}</td>
                  <td className="platform-admin-page__mono">{row.userId}</td>
                  <td>{row.username}</td>
                  <td>{row.legacyRole}</td>
                  <td>{row.membershipRole}</td>
                  <td>{row.status}</td>
                  <td className="platform-admin-page__muted">{row.createdAt ?? '—'}</td>
                  <td className="platform-admin-page__muted">{row.updatedAt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {!adminsLoading && !adminsError && industryRow && admins.length === 0 ? (
          <p className="platform-admin-page__muted">등록된 Industry Admin 이 없습니다.</p>
        ) : null}
      </section>

      {assignSuccessMessage ? (
        <div className="platform-admin-page__panel platform-admin-page__panel--success" role="status">
          <p>{assignSuccessMessage}</p>
        </div>
      ) : null}

      {assignErrorMessage ? (
        <div className="platform-admin-page__panel platform-admin-page__panel--error" role="alert">
          <p>{assignErrorMessage}</p>
        </div>
      ) : null}

      {canAssign ? (
        <section className="platform-admin-page__industry-create" aria-labelledby="assign-heading">
          <h2 id="assign-heading" className="platform-admin-page__subhead">
            Industry Admin 지정 (Super Admin)
          </h2>
          <form className="platform-admin-page__industry-create-form" onSubmit={onAssignSubmit}>
            <div className="platform-admin-page__form-field">
              <label className="dark-label" htmlFor="platform-industry-admin-userid">
                userId <span className="platform-admin-page__required">*</span>
              </label>
              <p className="platform-admin-page__field-hint">
                기존 사용자 테이블의 user id(users.id)를 그대로 입력합니다.
              </p>
              <FormInput
                id="platform-industry-admin-userid"
                name="userId"
                autoComplete="off"
                value={assignUserId}
                onChange={(e) => {
                  clearAssignFeedback()
                  setAssignUserId(e.target.value)
                }}
                disabled={assignSubmitting}
                placeholder="사용자 id (UUID)"
              />
            </div>
            <div className="platform-admin-page__form-actions">
              <FormButton
                htmlType="submit"
                variant="primary"
                loading={assignSubmitting}
                loadingText="지정 중…"
                disabled={assignSubmitting}
              >
                Industry Admin 지정
              </FormButton>
            </div>
          </form>
        </section>
      ) : null}

      <IndustryTenantsListSection variant="pc" {...tenantSectionProps} />
      <IndustryTenantCreateSection {...tenantSectionProps} />
    </main>
  )
}
