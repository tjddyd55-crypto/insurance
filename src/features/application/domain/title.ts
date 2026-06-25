import type { InsuranceApplicationFormData } from './types'
import { getKstDateString } from '../../../utils/displayDateTime'

function formatDatePart(isoDate: string): string {
  if (!isoDate) {
    return getKstDateString()
  }

  return isoDate
}

export function buildApplicationTitle(data: InsuranceApplicationFormData): string {
  const ownerName = data.ownerName.trim() || '이름없음'
  const vehicleNumber = data.vehicleNumber.trim() || '차량번호없음'
  const date = formatDatePart(data.expiryDate)

  return `${ownerName} / ${vehicleNumber} / ${date}`
}
