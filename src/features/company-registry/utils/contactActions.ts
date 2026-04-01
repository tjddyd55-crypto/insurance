/** 모바일/데스크톱 tel: 링크용 (숫자·+ 만 유지) */
export function toTelHref(phone: string): string {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : '#'
}

export function downloadContactVcard(params: {
  name: string
  phone: string
  companyName: string
  position?: string
}): void {
  const name = String(params.name ?? '').trim() || '담당자'
  const phone = String(params.phone ?? '').trim()
  const org = String(params.companyName ?? '').trim()
  const title = params.position ? String(params.position).trim() : ''

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    `N:${name};;;`,
    org ? `ORG:${org}` : '',
    title ? `TITLE:${title}` : '',
    phone ? `TEL;TYPE=CELL:${phone}` : '',
    'END:VCARD',
  ].filter(Boolean)

  const blob = new Blob([`${lines.join('\r\n')}\r\n`], {
    type: 'text/vcard;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const safe = `${org}_${name}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'contact'
  const a = document.createElement('a')
  a.href = url
  a.download = `${safe}.vcf`
  a.click()
  URL.revokeObjectURL(url)
}
