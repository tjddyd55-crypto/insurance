import type { CustomerCarRecord } from '../api/customerCarsApi'
import type { CustomerRecord } from '../domain/types'
import { isCustomerCarEmpty } from './customerCarFormUtils'

export type LegacyCarSlice = {
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
  carType: string
  memo: string
}

const MAX_NUMBERED_LEGACY_SLOTS = 10

const CAR_NUMBER_ALIASES = ['carNumber', 'car_number', 'vehicleNumber', 'vehicle_number'] as const
const CAR_MODEL_ALIASES = ['carModel', 'car_model', 'vehicleModel', 'vehicle_model'] as const
const CAR_YEAR_ALIASES = ['carYear', 'car_year', 'vehicleYear', 'vehicle_year'] as const
const CAR_TYPE_ALIASES = ['carType', 'car_type', 'vehicleType', 'vehicle_type'] as const
const RENEWAL_ALIASES = [
  'renewalDate',
  'renewal_date',
  'carInsuranceExpiryDate',
  'car_insurance_expiry_date',
  'insuranceRenewalDate',
  'insurance_renewal_date',
] as const

const CRM_VEHICLE_FIELD_RE =
  /^vehicle(\d*)\.(carNumber|carModel|carYear|carType|renewalDate)$/i

const CRM_SUFFIX_FIELD_RE = /^(carNumber|carModel|carYear|carType|renewalDate)(\d+)$/i

function trimStr(v: unknown): string {
  return String(v ?? '').trim()
}

function normalizeRenewalDate(raw: unknown): string {
  const s = trimStr(raw)
  if (!s) {
    return ''
  }
  const head = s.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : s
}

function emptySlice(): LegacyCarSlice {
  return {
    carNumber: '',
    carModel: '',
    carYear: '',
    renewalDate: '',
    carType: '',
    memo: '',
  }
}

export function hasAnyLegacyCarValue(car: LegacyCarSlice): boolean {
  return !isCustomerCarEmpty({
    carNumber: car.carNumber,
    carModel: car.carModel,
    carYear: car.carYear,
    renewalDate: car.renewalDate,
    carType: car.carType,
    memo: car.memo,
    isPrimary: false,
  })
}

function sliceFromPartial(partial: Partial<LegacyCarSlice>): LegacyCarSlice {
  return {
    carNumber: trimStr(partial.carNumber),
    carModel: trimStr(partial.carModel),
    carYear: trimStr(partial.carYear),
    renewalDate: normalizeRenewalDate(partial.renewalDate),
    carType: trimStr(partial.carType),
    memo: trimStr(partial.memo),
  }
}

function readFieldFromBag(
  bag: Record<string, unknown>,
  aliases: readonly string[],
  index: number,
): string {
  for (const base of aliases) {
    if (index === 0) {
      const direct = bag[base]
      if (direct != null && trimStr(direct)) {
        return trimStr(direct)
      }
      continue
    }

    const keys: string[] = [
      `${base}${index}`,
      `${base}_${index}`,
    ]

    const camelBase = base.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    if (camelBase !== base) {
      keys.push(`${camelBase}${index}`, `${camelBase}_${index}`)
    }

    if (base === 'carNumber' || base === 'car_number') {
      keys.push(`car${index}Number`, `car${index}_number`)
    }
    if (base === 'carModel' || base === 'car_model') {
      keys.push(`car${index}Model`, `car${index}_model`)
    }
    if (base === 'carYear' || base === 'car_year') {
      keys.push(`car${index}Year`, `car${index}_year`)
    }
    if (base === 'carType' || base === 'car_type') {
      keys.push(`car${index}Type`, `car${index}_type`)
    }
    if (base === 'renewalDate' || base === 'renewal_date') {
      keys.push(`car${index}RenewalDate`, `car${index}_renewal_date`, `car${index}InsuranceExpiryDate`)
    }

    for (const key of keys) {
      const v = bag[key]
      if (v != null && trimStr(v)) {
        return trimStr(v)
      }
    }
  }
  return ''
}

function readNumberedCarFromBag(bag: Record<string, unknown>, index: number): LegacyCarSlice {
  return sliceFromPartial({
    carNumber: readFieldFromBag(bag, CAR_NUMBER_ALIASES, index),
    carModel: readFieldFromBag(bag, CAR_MODEL_ALIASES, index),
    carYear: readFieldFromBag(bag, CAR_YEAR_ALIASES, index),
    renewalDate: readFieldFromBag(bag, RENEWAL_ALIASES, index),
    carType: readFieldFromBag(bag, CAR_TYPE_ALIASES, index),
  })
}

function sliceFromCustomerRecord(customer: CustomerRecord): LegacyCarSlice {
  return sliceFromPartial({
    carNumber: customer.carNumber,
    carModel: customer.carModel,
    carYear: customer.carYear,
    renewalDate: customer.renewalDate,
    carType: customer.carType,
  })
}

function sliceFromUnknownObject(raw: unknown): LegacyCarSlice | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const bag = raw as Record<string, unknown>
  const slice = sliceFromPartial({
    carNumber: readFieldFromBag(bag, CAR_NUMBER_ALIASES, 0),
    carModel: readFieldFromBag(bag, CAR_MODEL_ALIASES, 0),
    carYear: readFieldFromBag(bag, CAR_YEAR_ALIASES, 0),
    renewalDate: readFieldFromBag(bag, RENEWAL_ALIASES, 0),
    carType: readFieldFromBag(bag, CAR_TYPE_ALIASES, 0),
    memo: trimStr(bag.memo),
  })
  return hasAnyLegacyCarValue(slice) ? slice : null
}

function extractCarsFromEmbeddedArray(customer: CustomerRecord): LegacyCarSlice[] {
  const raw = (customer as Record<string, unknown>).cars
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item) => sliceFromUnknownObject(item))
    .filter((item): item is LegacyCarSlice => item != null)
}

function crmFieldToSliceKey(field: string): keyof LegacyCarSlice | null {
  const lower = field.toLowerCase()
  if (lower === 'carnumber') return 'carNumber'
  if (lower === 'carmodel') return 'carModel'
  if (lower === 'caryear') return 'carYear'
  if (lower === 'cartype') return 'carType'
  if (lower === 'renewaldate') return 'renewalDate'
  return null
}

function extractCarsFromCrmExtension(customer: CustomerRecord): LegacyCarSlice[] {
  const fields = customer.crmExtension?.fields
  if (!fields || typeof fields !== 'object') {
    return []
  }

  const byIndex = new Map<number, LegacyCarSlice>()

  for (const [key, rawValue] of Object.entries(fields)) {
    const value = trimStr(rawValue)
    if (!value) {
      continue
    }

    const vehicleMatch = key.match(CRM_VEHICLE_FIELD_RE)
    if (vehicleMatch) {
      const index = vehicleMatch[1] ? Number(vehicleMatch[1]) : 1
      const fieldKey = crmFieldToSliceKey(vehicleMatch[2])
      if (!fieldKey || !Number.isFinite(index) || index < 1) {
        continue
      }
      const slot = byIndex.get(index) ?? emptySlice()
      if (fieldKey === 'renewalDate') {
        slot.renewalDate = normalizeRenewalDate(value)
      } else {
        slot[fieldKey] = value
      }
      byIndex.set(index, slot)
      continue
    }

    const suffixMatch = key.match(CRM_SUFFIX_FIELD_RE)
    if (suffixMatch) {
      const fieldKey = crmFieldToSliceKey(suffixMatch[1])
      const index = Number(suffixMatch[2])
      if (!fieldKey || !Number.isFinite(index) || index < 1) {
        continue
      }
      const slot = byIndex.get(index) ?? emptySlice()
      if (fieldKey === 'renewalDate') {
        slot.renewalDate = normalizeRenewalDate(value)
      } else {
        slot[fieldKey] = value
      }
      byIndex.set(index, slot)
    }
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, slice]) => sliceFromPartial(slice))
    .filter(hasAnyLegacyCarValue)
}

/** 고객 행·확장 필드·임베디드 배열에서 레거시 차량 슬라이스를 추출한다. */
export function extractLegacyCustomerCars(customer: CustomerRecord): LegacyCarSlice[] {
  const bag = customer as Record<string, unknown>
  const cars: LegacyCarSlice[] = []

  for (const slice of extractCarsFromEmbeddedArray(customer)) {
    cars.push(slice)
  }

  const primary = sliceFromCustomerRecord(customer)
  if (hasAnyLegacyCarValue(primary)) {
    cars.push(primary)
  }

  for (let index = 1; index <= MAX_NUMBERED_LEGACY_SLOTS; index += 1) {
    const numbered = readNumberedCarFromBag(bag, index)
    if (hasAnyLegacyCarValue(numbered)) {
      cars.push(numbered)
    }
  }

  for (const extCar of extractCarsFromCrmExtension(customer)) {
    cars.push(extCar)
  }

  return dedupeLegacyCarSlices(cars)
}

export function legacyCarDedupeKey(car: LegacyCarSlice): string | null {
  const num = trimStr(car.carNumber)
  if (num) {
    return `num:${num}`
  }
  const model = trimStr(car.carModel)
  const year = trimStr(car.carYear)
  const renewal = trimStr(car.renewalDate)
  if (model || year || renewal) {
    return `combo:${model}|${year}|${renewal}`
  }
  return null
}

export function dedupeLegacyCarSlices(cars: LegacyCarSlice[]): LegacyCarSlice[] {
  const out: LegacyCarSlice[] = []
  const seen = new Set<string>()

  for (const car of cars) {
    if (!hasAnyLegacyCarValue(car)) {
      continue
    }
    const key = legacyCarDedupeKey(car)
    if (key) {
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
    }
    out.push(sliceFromPartial(car))
  }
  return out
}

export function legacyCarSlicesToRecords(
  customerId: number,
  slices: LegacyCarSlice[],
): CustomerCarRecord[] {
  return slices.map((car, index) => ({
    id: -(index + 1),
    customerId,
    carType: car.carType,
    carNumber: car.carNumber,
    carModel: car.carModel,
    carYear: car.carYear,
    renewalDate: car.renewalDate ? car.renewalDate : null,
    memo: car.memo,
    isPrimary: index === 0,
    sortOrder: index,
    createdAt: '',
    updatedAt: '',
  }))
}

export function formatCustomerCarRenewalYmd(renewalDate: string | null | undefined): string {
  if (!renewalDate?.trim()) {
    return ''
  }
  return String(renewalDate).trim().slice(0, 10)
}

export function sortCustomerCarsForPicker(cars: CustomerCarRecord[]): CustomerCarRecord[] {
  return [...cars].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1
    }
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder
    }
    return a.id - b.id
  })
}

export function dedupeCustomerCarRecords(cars: CustomerCarRecord[]): CustomerCarRecord[] {
  const out: CustomerCarRecord[] = []
  const seen = new Set<string>()

  for (const car of cars) {
    const slice = sliceFromPartial(car)
    if (!hasAnyLegacyCarValue(slice)) {
      continue
    }
    const key = legacyCarDedupeKey(slice)
    if (key) {
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
    }
    out.push(car)
  }
  return out
}

/** customer_cars API 우선, 비어 있으면 고객 행·확장 필드 레거시 차량 fallback */
export function resolveCustomerCarsForPicker(
  apiCars: CustomerCarRecord[],
  customer: CustomerRecord,
): CustomerCarRecord[] {
  const sortedApi = sortCustomerCarsForPicker(apiCars)
  if (sortedApi.length > 0) {
    return dedupeCustomerCarRecords(sortedApi)
  }
  const legacySlices = extractLegacyCustomerCars(customer)
  return legacyCarSlicesToRecords(customer.id, legacySlices)
}

const CAR_WORD_RE = /car|vehicle|차량|자동차|renewal/i

export function listCustomerKeysWithCarWords(customer: CustomerRecord): string[] {
  const bag = customer as Record<string, unknown>
  const keys = new Set<string>()

  for (const key of Object.keys(bag)) {
    if (CAR_WORD_RE.test(key)) {
      keys.add(key)
    }
  }

  const ext = customer.crmExtension?.fields
  if (ext) {
    for (const key of Object.keys(ext)) {
      if (CAR_WORD_RE.test(key)) {
        keys.add(`crmExtension.fields.${key}`)
      }
    }
  }

  return [...keys].sort()
}

export function collectCustomerRawCarFields(customer: CustomerRecord): Record<string, string> {
  const out: Record<string, string> = {}
  const bag = customer as Record<string, unknown>

  for (const key of listCustomerKeysWithCarWords(customer)) {
    if (key.startsWith('crmExtension.fields.')) {
      const fieldKey = key.slice('crmExtension.fields.'.length)
      const v = customer.crmExtension?.fields?.[fieldKey]
      if (v != null && trimStr(v)) {
        out[key] = trimStr(v)
      }
      continue
    }
    const v = bag[key]
    if (v != null && trimStr(v)) {
      out[key] = trimStr(v)
    }
  }

  return out
}
