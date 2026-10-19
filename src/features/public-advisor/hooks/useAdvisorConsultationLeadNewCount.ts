import { useEffect, useState } from 'react'
import { fetchAdvisorConsultationLeads } from '../api/advisorConsultationLeadsApi'

export function useAdvisorConsultationLeadNewCount(token: string | null | undefined, role: string | undefined) {
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    if (!token?.trim() || role !== 'USER') {
      setNewCount(0)
      return
    }
    let cancelled = false
    void fetchAdvisorConsultationLeads(token)
      .then((res) => {
        if (!cancelled) setNewCount(res.newCount ?? 0)
      })
      .catch(() => {
        if (!cancelled) setNewCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [token, role])

  return newCount
}
