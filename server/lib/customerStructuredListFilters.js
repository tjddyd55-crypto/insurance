import { escapeIlikePattern } from './customerConsultationListQuery.js'

/**
 * @param {Array<{ field: string, operator: string, value: unknown, valueTo?: string | null }>} filters
 * @param {{ userPlaceholder: string, gaPlaceholder: string, paramStart: number }} ctx
 */
export function buildCustomerStructuredFilterSql(filters, ctx) {
  const whereFragments = []
  const params = []
  let nextIdx = ctx.paramStart

  for (const f of filters ?? []) {
    const built = compileOneFilter(f, { ...ctx, paramStart: nextIdx })
    if (built.fragment) {
      whereFragments.push(built.fragment)
      params.push(...built.params)
      nextIdx = built.nextIdx
    }
  }

  return { whereFragments, params, nextIdx }
}

function compileOneFilter(filter, ctx) {
  const field = String(filter.field ?? '')
  const op = String(filter.operator ?? '').toUpperCase()
  let nextIdx = ctx.paramStart
  const ph = () => {
    const p = `$${nextIdx}`
    nextIdx += 1
    return p
  }

  if (field === 'gender') {
    if (op === 'EQ') {
      const p = ph()
      return frag(`c.gender = ${p}`, [filter.value], nextIdx)
    }
    if (op === 'IN' && Array.isArray(filter.value)) {
      const p = ph()
      return frag(`c.gender = ANY(${p}::text[])`, [filter.value], nextIdx)
    }
  }

  if (field === 'name' || field === 'job') {
    const col = field === 'name' ? 'c.name' : 'c.job'
    return stringColumn(col, op, filter, ph, nextIdx)
  }

  if (field === 'phone') {
    if (op === 'ENDS_WITH') {
      const digits = String(filter.value ?? '').replace(/\D/g, '')
      const p = ph()
      return frag(`regexp_replace(c.phone, '\\D', '', 'g') LIKE ${p} ESCAPE '\\'`, [`%${escapeIlikePattern(digits)}`], nextIdx)
    }
    return stringColumn('c.phone', op, filter, ph, nextIdx)
  }

  if (field === 'address' && (op === 'CONTAINS' || op === 'EQ')) {
    const p = ph()
    const pattern = op === 'EQ' ? escapeIlikePattern(String(filter.value)) : `%${escapeIlikePattern(String(filter.value))}%`
    return frag(
      `(c.address ILIKE ${p} ESCAPE '\\' OR c.address_sido ILIKE ${p} ESCAPE '\\' OR c.address_sigungu ILIKE ${p} ESCAPE '\\')`,
      [pattern],
      nextIdx,
    )
  }

  if (field === 'carNumber') {
    if (op === 'IS_NULL') {
      return frag(
        `(COALESCE(TRIM(c.car_number), '') = '' AND NOT EXISTS (
        SELECT 1 FROM customer_cars cc
        WHERE cc.customer_id = c.id AND cc.user_id = ${ctx.userPlaceholder}::text AND cc.ga_id = ${ctx.gaPlaceholder}::integer
          AND COALESCE(TRIM(cc.car_number), '') <> ''
      ))`,
        [],
        nextIdx,
      )
    }
    if (op === 'IS_NOT_NULL') {
      return frag(
        `(COALESCE(TRIM(c.car_number), '') <> '' OR EXISTS (
        SELECT 1 FROM customer_cars cc
        WHERE cc.customer_id = c.id AND cc.user_id = ${ctx.userPlaceholder}::text AND cc.ga_id = ${ctx.gaPlaceholder}::integer
          AND COALESCE(TRIM(cc.car_number), '') <> ''
      ))`,
        [],
        nextIdx,
      )
    }
    const p = ph()
    const pattern = `%${escapeIlikePattern(String(filter.value))}%`
    return frag(
      `(c.car_number ILIKE ${p} ESCAPE '\\' OR EXISTS (
        SELECT 1 FROM customer_cars cc
        WHERE cc.customer_id = c.id AND cc.user_id = ${ctx.userPlaceholder}::text AND cc.ga_id = ${ctx.gaPlaceholder}::integer
          AND cc.car_number ILIKE ${p} ESCAPE '\\'
      ))`,
      [pattern],
      nextIdx,
    )
  }

  if (field === 'carModel') {
    if (op === 'IS_NULL') {
      return frag(`COALESCE(TRIM(c.car_model), '') = ''`, [], nextIdx)
    }
    if (op === 'IS_NOT_NULL') {
      return frag(`COALESCE(TRIM(c.car_model), '') <> ''`, [], nextIdx)
    }
    return stringColumn('c.car_model', op, filter, ph, nextIdx)
  }

  if (field === 'renewalDate' || field === 'createdAt') {
    const col = field === 'renewalDate' ? 'c.renewal_date' : 'c.created_at::date'
    if (op === 'BETWEEN' || op === 'PERIOD') {
      const p1 = ph()
      const p2 = ph()
      return frag(`${col} >= ${p1}::date AND ${col} <= ${p2}::date`, [filter.value, filter.valueTo], nextIdx)
    }
    if (op === 'AFTER') {
      const p = ph()
      return frag(`${col} > ${p}::date`, [filter.value], nextIdx)
    }
    if (op === 'BEFORE') {
      const p = ph()
      return frag(`${col} < ${p}::date`, [filter.value], nextIdx)
    }
    if (op === 'EQ') {
      const p = ph()
      return frag(`${col} = ${p}::date`, [filter.value], nextIdx)
    }
  }

  if (field === 'company' || field === 'insurer') {
    const cfLabel = field === 'company' ? '회사명' : '주력보험사'
    const existsBase = `EXISTS (
      SELECT 1 FROM customer_custom_fields cf
      WHERE cf.customer_id = c.id
        AND cf.user_id = ${ctx.userPlaceholder}::text
        AND cf.ga_id = ${ctx.gaPlaceholder}::integer
        AND cf.deleted_at IS NULL`
    if (op === 'EQ') {
      const pLabel = ph()
      const pVal = ph()
      return frag(`${existsBase} AND cf.label = ${pLabel} AND cf.value = ${pVal})`, [cfLabel, filter.value], nextIdx)
    }
    if (op === 'CONTAINS') {
      const pLabel = ph()
      const pVal = ph()
      return frag(
        `${existsBase} AND cf.label = ${pLabel} AND cf.value ILIKE ${pVal} ESCAPE '\\')`,
        [cfLabel, `%${escapeIlikePattern(String(filter.value))}%`],
        nextIdx,
      )
    }
  }

  if (field === 'labels') {
    const existsBase = `EXISTS (
      SELECT 1 FROM customer_custom_fields cf
      WHERE cf.customer_id = c.id
        AND cf.user_id = ${ctx.userPlaceholder}::text
        AND cf.ga_id = ${ctx.gaPlaceholder}::integer
        AND cf.deleted_at IS NULL`
    const tag = String(filter.value ?? '').trim()
    const p = ph()
    if (op === 'INCLUDES') {
      return frag(`${existsBase} AND cf.label = ${p})`, [tag], nextIdx)
    }
    if (op === 'EXCLUDES') {
      return frag(`${existsBase} AND cf.label = ${p})`, [tag], nextIdx)
    }
  }

  if (field === 'insuranceAge') {
    const min = filter.value
    const max = filter.valueTo ?? filter.value
    const p1 = ph()
    const p2 = ph()
    return frag(`c.insurance_age >= ${p1}::int AND c.insurance_age <= ${p2}::int`, [min, max], nextIdx)
  }

  return frag('', [], nextIdx)
}

function stringColumn(column, op, filter, ph, nextIdx) {
  const raw = String(filter.value ?? '')
  if (op === 'EQ') {
    const p = ph()
    return frag(`${column} = ${p}`, [raw], nextIdx)
  }
  if (op === 'CONTAINS' || op === 'STARTS_WITH') {
    const p = ph()
    const pattern = op === 'STARTS_WITH' ? `${escapeIlikePattern(raw)}%` : `%${escapeIlikePattern(raw)}%`
    return frag(`${column} ILIKE ${p} ESCAPE '\\'`, [pattern], nextIdx)
  }
  return frag('', [], nextIdx)
}

function frag(fragment, params, nextIdx) {
  return { fragment, params, nextIdx }
}
