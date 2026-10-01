/**
 * 한국 주소를 시/도 · 시/군/구 · 읍/면/동 으로 나눈다.
 * 원문 주소 문자열은 바꾸지 않는다. 파싱 실패 필드는 null.
 */

const SIDO_ALIASES = [
  ['서울특별시', '서울시', '서울'],
  ['부산광역시', '부산시', '부산'],
  ['대구광역시', '대구시', '대구'],
  ['인천광역시', '인천시', '인천'],
  ['광주광역시', '광주시', '광주'],
  ['대전광역시', '대전시', '대전'],
  ['울산광역시', '울산시', '울산'],
  ['세종특별자치시', '세종시', '세종'],
  ['제주특별자치도', '제주도', '제주'],
  ['강원특별자치도', '강원도', '강원'],
  ['전북특별자치도', '전라북도', '전북'],
  ['충청북도', '충북'],
  ['충청남도', '충남'],
  ['전라남도', '전남'],
  ['경상북도', '경북'],
  ['경상남도', '경남'],
  ['경기도', '경기'],
].flatMap(([canonical, ...aliases]) =>
  [canonical, ...aliases].map((alias) => ({ alias, canonical })),
)

SIDO_ALIASES.sort((a, b) => b.alias.length - a.alias.length)

const SEJONG = '세종특별자치시'

const EXPLICIT_KEYS = [
  'addressSido',
  'address_sido',
  'sido',
  'addressSigungu',
  'address_sigungu',
  'sigungu',
  'addressEupmyeondong',
  'address_eupmyeondong',
  'bname',
  'bname1',
  'bname2',
]

/**
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function canonicalizeSido(raw) {
  const text = String(raw ?? '').trim()
  if (!text) {
    return null
  }
  const found = SIDO_ALIASES.find((entry) => entry.alias === text)
  return found ? found.canonical : null
}

/**
 * @param {string} token
 */
export function isEupMyeonDongToken(token) {
  if (!token || /\s/.test(token)) {
    return false
  }
  if (/\d+가$/.test(token)) {
    return true
  }
  if (/(로|길|대로)$/.test(token)) {
    return false
  }
  return /(읍|면|동|리)$/.test(token)
}

/**
 * @param {string} token
 */
function isGuToken(token) {
  return /[가-힣0-9]+구$/.test(token)
}

/**
 * @param {string} token
 */
function isGunToken(token) {
  return /[가-힣]+군$/.test(token)
}

/**
 * @param {string} token
 */
function isCityToken(token) {
  return /[가-힣]+시$/.test(token)
}

/**
 * @returns {{ addressSido: null, addressSigungu: null, addressEupmyeondong: null }}
 */
export function emptyAddressRegion() {
  return { addressSido: null, addressSigungu: null, addressEupmyeondong: null }
}

/**
 * @param {string} raw
 */
function stripZipPrefix(raw) {
  return raw.replace(/^\(\s*\d{5}\s*\)\s*/, '').trim()
}

/**
 * @param {string} raw
 * @returns {{ body: string, parenTokens: string[] }}
 */
function splitParentheticals(raw) {
  const parenTokens = []
  const body = raw.replace(/\(([^)]*)\)/g, (_, inner) => {
    for (const token of String(inner).split(/[\s,]+/)) {
      const trimmed = token.trim()
      if (trimmed) {
        parenTokens.push(trimmed)
      }
    }
    return ' '
  })
  return { body: body.replace(/\s+/g, ' ').trim(), parenTokens }
}

/**
 * @param {string[]} tokens
 * @returns {string | null}
 */
function firstAdminDong(tokens) {
  for (const token of tokens) {
    if (isEupMyeonDongToken(token)) {
      return token
    }
  }
  return null
}

/**
 * @param {string | null | undefined} address
 * @returns {{ addressSido: string | null, addressSigungu: string | null, addressEupmyeondong: string | null }}
 */
export function parseKoreanAddressRegion(address) {
  const original = String(address ?? '')
  const stripped = stripZipPrefix(original.replace(/,/g, ' '))
  const { body, parenTokens } = splitParentheticals(stripped)
  if (!body) {
    return emptyAddressRegion()
  }

  const matched = SIDO_ALIASES.find(
    (entry) => body === entry.alias || body.startsWith(`${entry.alias} `),
  )
  if (!matched) {
    return emptyAddressRegion()
  }

  const rest = body.slice(matched.alias.length).trim()
  const tokens = rest.split(/\s+/).filter(Boolean)
  const region = {
    addressSido: matched.canonical,
    addressSigungu: null,
    addressEupmyeondong: null,
  }

  let index = 0
  if (matched.canonical !== SEJONG) {
    const head = tokens[0] ?? ''
    const next = tokens[1] ?? ''
    if (isCityToken(head) && isGuToken(next)) {
      region.addressSigungu = `${head} ${next}`
      index = 2
    } else if (isCityToken(head) || isGunToken(head) || isGuToken(head)) {
      region.addressSigungu = head
      index = 1
    }
  }

  region.addressEupmyeondong =
    firstAdminDong(tokens.slice(index)) ?? firstAdminDong(parenTokens)
  return region
}

/**
 * @param {Record<string, unknown>} data
 */
function hasExplicitRegion(data) {
  return EXPLICIT_KEYS.some((key) => Object.prototype.hasOwnProperty.call(data, key))
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function nullIfBlank(raw) {
  const text = String(raw ?? '').trim()
  return text || null
}

/**
 * @param {Record<string, unknown>} data
 * @param {...string} keys
 */
function firstOwn(data, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return data[key]
    }
  }
  return undefined
}

/**
 * 카카오 우편번호 결과 또는 명시 필드를 우선하고, 없으면 주소 문자열을 파싱한다.
 * @param {Record<string, unknown> | null | undefined} data
 */
export function resolveCustomerAddressRegion(data) {
  if (!data || typeof data !== 'object') {
    return emptyAddressRegion()
  }
  if (!hasExplicitRegion(data)) {
    return parseKoreanAddressRegion(String(data.address ?? ''))
  }

  const sido = canonicalizeSido(firstOwn(data, 'addressSido', 'address_sido', 'sido'))
  const sigunguRaw = nullIfBlank(firstOwn(data, 'addressSigungu', 'address_sigungu', 'sigungu'))
  const directDong = nullIfBlank(
    firstOwn(data, 'addressEupmyeondong', 'address_eupmyeondong'),
  )
  const fromBname = [data.bname2, data.bname1, data.bname]
    .map((value) => String(value ?? '').trim())
    .find((token) => isEupMyeonDongToken(token))

  return {
    addressSido: sido,
    addressSigungu: sido === SEJONG ? null : sigunguRaw,
    addressEupmyeondong: directDong ?? fromBname ?? null,
  }
}
