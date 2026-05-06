import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../../../lib/apiClient'
import {
  assignPlatformIndustryAdmin,
  fetchPlatformIndustryAdmins,
  fetchPlatformIndustries,
} from '../api/platformAdminApi'
import type { AssignPlatformIndustryAdminResult, PlatformIndustryAdminMember, PlatformIndustryRow } from '../platformAdmin.types'

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
}

export function useIndustryAdminDetailState(
  industryIdParam: string | undefined,
  token: string | null,
): UseIndustryAdminDetailStateResult {
  const industryIdKey = useMemo(() => parseIndustryIdParam(industryIdParam), [industryIdParam])
  const industryParamInvalid =
    industryIdParam !== undefined && industryIdParam !== null && String(industryIdParam).trim() !== '' && industryIdKey == null

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
  const industryMissingFromList = industriesFetched && industryIdKey != null && industryRow == null && !industriesError

  const [admins, setAdmins] = useState<PlatformIndustryAdminMember[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [adminsError, setAdminsError] = useState<string | null>(null)

  const [assignUserId, setAssignUserId] = useState('')
  const [assignSubmitting, setAssignSubmitting] = useState(false)
  const [assignSuccessMessage, setAssignSuccessMessage] = useState<string | null>(null)
  const [assignErrorMessage, setAssignErrorMessage] = useState<string | null>(null)

  const clearAssignFeedback = useCallback(() => {
    setAssignSuccessMessage(null)
    setAssignErrorMessage(null)
  }, [])

  const reload = useCallback(async () => {
    if (!token || industryIdKey == null || industryParamInvalid) {
      setIndustriesLoading(false)
      setIndustryRows([])
      setIndustriesFetched(false)
      setAdmins([])
      return
    }

    setIndustriesLoading(true)
    setIndustriesError(null)
    setAdminsError(null)
    setIndustriesFetched(false)
    try {
      const res = await fetchPlatformIndustries(token)
      setIndustryRows(res.items)
      setIndustriesFetched(true)
      const meta = res.items.find((r) => r.id === industryIdKey)
      if (!meta) {
        setAdmins([])
        return
      }

      setAdminsLoading(true)
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
    } catch (e) {
      setIndustryRows([])
      setIndustriesFetched(true)
      setAdmins([])
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
  }
}
