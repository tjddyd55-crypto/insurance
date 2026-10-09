import { useMemo } from 'react'
import { GaCustomerExcelManagementPanel } from '../../admin/components/GaCustomerExcelManagementPanel'
import { createGaAdminGaExcelManagementApi } from '../../admin/components/gaCustomerExcelManagementApi'
import { useAuth } from '../../auth/AuthProvider'
import { useGaSettings } from '../../ga-settings/useGaSettings'

export default function GaAdminFeaturesSettingsPanel() {
  const { token, user } = useAuth()
  const { refresh: refreshGaCapability } = useGaSettings()
  const api = useMemo(() => {
    if (!token?.trim() || user?.role !== 'GA_ADMIN') {
      return null
    }
    return createGaAdminGaExcelManagementApi(token)
  }, [token, user?.role])

  if (!api) {
    return null
  }

  return (
    <div className="admin-data-card">
      <h2 className="admin-data-card__title">GA 기능 설정 · 고객 엑셀 관리</h2>
      <GaCustomerExcelManagementPanel api={api} onSaved={() => void refreshGaCapability()} />
    </div>
  )
}
