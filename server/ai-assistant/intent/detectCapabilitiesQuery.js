/**
 * Minimal safe detection when GPT is unavailable or mislabels capability questions.
 * @param {string} text
 */
export function detectCapabilitiesQuery(text) {
  const t = String(text ?? '').trim()
  if (!t) {
    return false
  }
  if (!/(할\s*수|가능|기능|물어볼|뭘\s*(할|해|물어)|무엇을)/.test(t)) {
    return false
  }
  if (/여기서|지금|AI\s*비서|비서로|이\s*화면/.test(t)) {
    return true
  }
  if (/가능한\s*기능|뭐\s*할\s*수|어떤\s*기능/.test(t)) {
    return true
  }
  return /^(뭘|무엇을)\s*(할\s*수|해)/.test(t)
}

/**
 * @param {string} text
 */
export function detectCustomerQueryableFieldsHelp(text) {
  const t = String(text ?? '').trim()
  if (!t) {
    return false
  }
  return /어떤\s*조건|무엇으로\s*찾|뭘로\s*찾|어떤\s*항목으로/.test(t) && /고객/.test(t)
}
