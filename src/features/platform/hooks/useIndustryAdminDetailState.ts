import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../../../lib/apiClient'
import {
  assignPlatformIndustryAdmin,
  createPlatformTenant,
  fetchPlatformIndustryAdmins,
  fetchPlatformIndustries,
  fetchPlatformTenants,
} from '../api/platformAdminApi'
import type {
  AssignPlatformIndustryAdminResult,
  PlatformIndustryAdminMember,
  PlatformIndustryRow,
  PlatformTenantRow,
  TenantStatus,
} from '../platformAdmin.types'

const RESERVED_PLATFORM_TENANT_CODE = 'yjasset'
const PLATFORM_TENANT_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

function parseIndustryIdParam(raw: string | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null
  }
  const t = String(raw).trim()
  if (!/^[1-9]\d*$/.test(t)) {
    return null
  }
  return t
}

function mapAssignError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'Industry Admin 지정에 실패했습니다.'
  }
  if (err.status === 401) {
    return '로그인이 필요하거나 세션이 만료되었습니다.'
  }
  if (err.status === 403) {
    return 'Industry Admin 지정 권한이 없습니다.'
  }
  if (err.status === 409) {
    return err.message.trim() !== '' ? err.message.trim() : '멤버십이 충돌했습니다. 잠시 후 다시 시도해 주세요.'
  }
  const msg = err.message.trim()
  return msg !== '' ? msg : 'Industry Admin 지정에 실패했습니다.'
}

function feedbackForAssignResult(result: AssignPlatformIndustryAdminResult['result']): string {
  if (result === 'created') {
    return 'Industry Admin으로 지정했습니다. (created)'
  }
  if (result === 'already_active') {
    return '이미 Industry Admin으로 등록된 사용자입니다. (already_active)'
  }
  return 'Industry Admin 권한을 다시 활성화했습니다. (reactivated)'
}

function validateTenantCreateClient(input: {
  codeRaw: string
  nameRaw: string
  status: TenantStatus
  legacyGaIdRaw: string
}): { ok: true; code: string; name: string; legacyGaId: number | undefined } | { ok: false; message: string } {
  const code = input.codeRaw.trim().toLowerCase()
  if (!code) {
    return { ok: false, message: 'code를 입력해 주세요.' }
  }
  if (code === RESERVED_PLATFORM_TENANT_CODE) {
    return {
      ok: false,
      message: '`yjasset`은 예약 코드라 새 Tenant 에 사용할 수 없습니다.',
    }
  }
  if (!PLATFORM_TENANT_CODE_PATTERN.test(code)) {
    return {
      ok: false,
      message:
        'code 형식이 올바르지 않습니다. 소문자/숫자로 시작 후 영문 소문자·숫자·_- 만 사용합니다.',
    }
  }

  const name = input.nameRaw.trim()
  if (!name) {
    return { ok: false, message: 'name을 입력해 주세요.' }
  }
  if (name.length > 200) {
    return { ok: false, message: 'name은 200자 이하여야 합니다.' }
  }

  if (input.status !== 'active' && input.status !== 'inactive') {
    return { ok: false, message: 'status는 active 또는 inactive 여야 합니다.' }
  }

  const gaTrim = input.legacyGaIdRaw.trim()
  if (!gaTrim) {
    return { ok: true, code, name, legacyGaId: undefined }
  }
  if (!/^[1-9]\d*$/.test(gaTrim)) {
    return { ok: false, message: 'legacyGaId는 양의 정수여야 합니다.' }
  }
  const legacyGaId = Number(gaTrim)
  if (!Number.isSafeInteger(legacyGaId) || legacyGaId < 1) {
    return { ok: false, message: 'legacyGaId는 양의 정수여야 합니다.' }
  }

  return { ok: true, code, name, legacyGaId }
}

function mapTenantCreateError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'Tenant 생성에 실패했습니다.'
  }
  if (err.status === 401) {
    return '로그인이 필요하거나 세션이 만료되었습니다.'
  }
  if (err.status === 403) {
    return 'Tenant 생성 권한이 없습니다.'
  }
  if (err.status === 404) {
    return err.message.trim() !== ''
      ? err.message.trim()
      : '요청한 업종을 찾을 수 없습니다.'
  }
  const msg = err.message.trim()
  return msg !== '' ? msg : 'Tenant 생성에 실패했습니다.'
}

export type UseIndustryAdminDetailStateResult = {
  industryIdKey: string | null
  industryParamInvalid: boolean
  industriesLoading: boolean
  industriesError: string | null
  industryRow: PlatformIndustryRow | null
  industryMissingFromList: boolean
  admins: PlatformIndustryAdminMember[]
  adminsLoading: boolean
  adminsError: string | null
  assignUserId: string
  setAssignUserId: (v: string) => void
  assignSubmitting: boolean
  assignSuccessMessage: string | null
  assignErrorMessage: string | null
  reload: () => Promise<void>
  onAssignSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>
  clearAssignFeedback: () => void
  tenantsForIndustry: PlatformTenantRow[]
  tenantsLoading: boolean
  tenantsError: string | null
  refetchTenants: () => Promise<void>
  canCreateTenant: boolean
  industryInactive: boolean
  tenantCreateCode: string
  setTenantCreateCode: (v: string) => void
  tenantCreateName: string
  setTenantCreateName: (v: string) => void
  tenantCreateStatus: TenantStatus
  setTenantCreateStatus: (v: TenantStatus) => void
  tenantCreateLegacyGaId: string
  setTenantCreateLegacyGaId: (v: string) => void
  tenantCreateSubmitting: boolean
  tenantCreateSuccessMessage: string | null
  tenantCreateErrorMessage: string | null
  onTenantCreateSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>
  clearTenantCreateFeedback: () => void
}

export function useIndustryAdminDetailState(
  industryIdParam: string | undefined,
  token: string | null,
): UseIndustryAdminDetailStateResult {
  const industryIdKey = useMemo(() => parseIndustryIdParam(industryIdParam), [industryIdParam])
  const industryParamInvalid =
    industryIdParam !== undefined &&
    industryIdParam !== null &&
    String(industryIdParam).trim() !== '' &&
    industryIdKey == null

  const [industriesLoading, setIndustriesLoading] = useState(true)
  const [industriesError, setIndustriesError] = useState<string | null>(null)
  const [industryRows, setIndustryRows] = useState<PlatformIndustryRow[]>([])
  const industryRow = useMemo(() => {
    if (industryIdKey == null) {
      return null
    }
    return industryRows.find((r) => r.id === industryIdKey) ?? null
  }, [industryRows, industryIdKey])

  const [industriesFetched, setIndustriesFetched] = useState(false)
  const industryMissingFromList =
    industriesFetched && industryIdKey != null && industryRow == null && !industriesError

  const industryInactive = useMemo(() => {
    if (!industryRow) {
      return false
    }
    return String(industryRow.status ?? '').trim().toLowerCase() !== 'active'
  }, [industryRow])

  const canCreateTenant = Boolean(industryRow) && !industryInactive && !industriesLoading && !industriesError

  const [tenantRowsAll, setTenantRowsAll] = useState<PlatformTenantRow[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [tenantsError, setTenantsError] = useState<string | null>(null)

  const tenantsForIndustry = useMemo(() => {
    if (industryIdKey == null) {
      return []
    }
    return tenantRowsAll.filter((r) => r.industryId === industryIdKey)
  }, [tenantRowsAll, industryIdKey])

  const [admins, setAdmins] = useState<PlatformIndustryAdminMember[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [adminsError, setAdminsError] = useState<string | null>(null)

  const [assignUserId, setAssignUserId] = useState('')
  const [assignSubmitting, setAssignSubmitting] = useState(false)
  const [assignSuccessMessage, setAssignSuccessMessage] = useState<string | null>(null)
  const [assignErrorMessage, setAssignErrorMessage] = useState<string | null>(null)

  const [tenantCreateCode, setTenantCreateCode] = useState('')
  const [tenantCreateName, setTenantCreateName] = useState('')
  const [tenantCreateStatus, setTenantCreateStatus] = useState<TenantStatus>('active')
  const [tenantCreateLegacyGaId, setTenantCreateLegacyGaId] = useState('')
  const [tenantCreateSubmitting, setTenantCreateSubmitting] = useState(false)
  const [tenantCreateSuccessMessage, setTenantCreateSuccessMessage] = useState<string | null>(null)
  const [tenantCreateErrorMessage, setTenantCreateErrorMessage] = useState<string | null>(null)

  const clearAssignFeedback = useCallback(() => {
    setAssignSuccessMessage(null)
    setAssignErrorMessage(null)
  }, [])

  const clearTenantCreateFeedback = useCallback(() => {
    setTenantCreateSuccessMessage(null)
    setTenantCreateErrorMessage(null)
  }, [])

  const refetchTenants = useCallback(async () => {
    if (!token || industryIdKey == null || industryParamInvalid) {
      return
    }
    setTenantsLoading(true)
    setTenantsError(null)
    try {
      const t = await fetchPlatformTenants(token)
      setTenantRowsAll(t.items)
    } catch (e) {
      setTenantRowsAll([])
      setTenantsError(
        e instanceof ApiError ? e.message : 'Tenant 목록을 불러오지 못했습니다.',
      )
    } finally {
      setTenantsLoading(false)
    }
  }, [token, industryIdKey, industryParamInvalid])

  const reload = useCallback(async () => {
    if (!token || industryIdKey == null || industryParamInvalid) {
      setIndustriesLoading(false)
      setIndustryRows([])
      setIndustriesFetched(false)
      setAdmins([])
      setTenantRowsAll([])
      setTenantsError(null)
      return
    }

    setIndustriesLoading(true)
    setIndustriesError(null)
    setAdminsError(null)
    setTenantsError(null)
    setIndustriesFetched(false)
    try {
      const res = await fetchPlatformIndustries(token)
      setIndustryRows(res.items)
      setIndustriesFetched(true)
      const meta = res.items.find((r) => r.id === industryIdKey)
      if (!meta) {
        setAdmins([])
        setTenantRowsAll([])
        return
      }

      setAdminsLoading(true)
      setTenantsLoading(true)
      try {
        const a = await fetchPlatformIndustryAdmins(token, industryIdKey)
        setAdmins(a.items)
      } catch (ae) {
        setAdmins([])
        setAdminsError(
          ae instanceof ApiError ? ae.message : 'Industry Admin 목록을 불러오지 못했습니다.',
        )
      } finally {
        setAdminsLoading(false)
      }

      try {
        const t = await fetchPlatformTenants(token)
        setTenantRowsAll(t.items)
      } catch (te) {
        setTenantRowsAll([])
        setTenantsError(
          te instanceof ApiError ? te.message : 'Tenant 목록을 불러오지 못했습니다.',
        )
      } finally {
        setTenantsLoading(false)
      }
    } catch (e) {
      setIndustryRows([])
      setIndustriesFetched(true)
      setAdmins([])
      setTenantRowsAll([])
      setIndustriesError(
        e instanceof ApiError ? e.message : 'Industry 목록을 불러오지 못했습니다.',
      )
    } finally {
      setIndustriesLoading(false)
    }
  }, [token, industryIdKey, industryParamInvalid])

  useEffect(() => {
    void reload()
  }, [reload])

  const onAssignSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!token || industryIdKey == null) {
        return
      }

      clearAssignFeedback()

      const uid = assignUserId.trim()
      if (!uid) {
        setAssignErrorMessage('userId를 입력해 주세요.')
        return
      }

      setAssignSubmitting(true)
      try {
        const out = await assignPlatformIndustryAdmin(token, industryIdKey, { userId: uid })
        setAssignSuccessMessage(feedbackForAssignResult(out.result))
        setAssignUserId('')
        setAdminsLoading(true)
        setAdminsError(null)
        try {
          const a = await fetchPlatformIndustryAdmins(token, industryIdKey)
          setAdmins(a.items)
        } catch (ae) {
          setAdminsError(
            ae instanceof ApiError ? ae.message : 'Industry Admin 목록을 갱신하지 못했습니다.',
          )
        } finally {
          setAdminsLoading(false)
        }
      } catch (err) {
        setAssignErrorMessage(mapAssignError(err))
      } finally {
        setAssignSubmitting(false)
      }
    },
    [token, industryIdKey, assignUserId, clearAssignFeedback],
  )

  const onTenantCreateSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!token || industryIdKey == null) {
        return
      }
      clearTenantCreateFeedback()

      const parsed = validateTenantCreateClient({
        codeRaw: tenantCreateCode,
        nameRaw: tenantCreateName,
        status: tenantCreateStatus,
        legacyGaIdRaw: tenantCreateLegacyGaId,
      })
      if (!parsed.ok) {
        setTenantCreateErrorMessage(parsed.message)
        return
      }

      setTenantCreateSubmitting(true)
      try {
        await createPlatformTenant(token, industryIdKey, {
          code: parsed.code,
          name: parsed.name,
          status: tenantCreateStatus,
          legacyGaId: parsed.legacyGaId,
        })

        setTenantCreateSuccessMessage(
          `Tenant 를 생성했습니다: code="${parsed.code}" (status=${tenantCreateStatus}${parsed.legacyGaId != null ? `, legacyGaId=${parsed.legacyGaId}` : ''}).`,
        )
        setTenantCreateCode('')
        setTenantCreateName('')
        setTenantCreateStatus('active')
        setTenantCreateLegacyGaId('')

        setTenantsLoading(true)
        setTenantsError(null)
        try {
          const t = await fetchPlatformTenants(token)
          setTenantRowsAll(t.items)
        } catch (te) {
          setTenantsError(
            te instanceof ApiError ? te.message : 'Tenant 목록을 갱신하지 못했습니다.',
          )
        } finally {
          setTenantsLoading(false)
        }
      } catch (err) {
        setTenantCreateErrorMessage(mapTenantCreateError(err))
      } finally {
        setTenantCreateSubmitting(false)
      }
    },
    [
      token,
      industryIdKey,
      tenantCreateCode,
      tenantCreateName,
      tenantCreateStatus,
      tenantCreateLegacyGaId,
      clearTenantCreateFeedback,
    ],
  )

  return {
    industryIdKey,
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
  }
}
