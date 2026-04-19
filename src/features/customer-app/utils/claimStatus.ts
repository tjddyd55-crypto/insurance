export type CustomerClaimStatus = 'requested' | 'processing' | 'done' | 'rejected' | 'canceled'

type StatusMeta = {
  label: string
  className: string
}

const STATUS_META: Record<CustomerClaimStatus, StatusMeta> = {
  requested: {
    label: '요청됨',
    className: 'bg-slate-600/20 text-slate-200 border-slate-500/40',
  },
  processing: {
    label: '처리중',
    className: 'bg-blue-600/20 text-blue-200 border-blue-500/40',
  },
  done: {
    label: '완료',
    className: 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40',
  },
  rejected: {
    label: '반려',
    className: 'bg-red-600/20 text-red-200 border-red-500/40',
  },
  canceled: {
    label: '취소',
    className: 'bg-zinc-600/20 text-zinc-200 border-zinc-500/40',
  },
}

export function resolveClaimStatusMeta(statusRaw: string | null | undefined): StatusMeta {
  const key = String(statusRaw ?? '').trim().toLowerCase() as CustomerClaimStatus
  return STATUS_META[key] ?? {
    label: String(statusRaw ?? '알 수 없음'),
    className: 'bg-amber-600/20 text-amber-200 border-amber-500/40',
  }
}

