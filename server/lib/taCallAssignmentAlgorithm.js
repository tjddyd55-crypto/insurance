/**
 * 중복 방지 순환 랜덤 배정 — 순수 함수 (테스트용).
 */

/**
 * @template T
 * @param {T[]} items
 * @returns {T[]}
 */
export function shuffleArray(items) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/**
 * @param {number[]} eligibleCustomerIds
 * @param {number} targetCount
 * @param {number} currentRound
 * @param {Set<number>} roundAssignedIds 현재 회차에 이미 배정된 customer_id
 * @param {Set<number>} todayAssignedIds 오늘 이미 배정된 customer_id
 * @param {() => number} [randomFn]
 * @returns {{ picks: number[]; rotationRound: number }}
 */
export function pickTaAssignments(
  eligibleCustomerIds,
  targetCount,
  currentRound,
  roundAssignedIds,
  todayAssignedIds,
  randomFn = Math.random,
) {
  const need = Math.max(0, targetCount - todayAssignedIds.size)
  if (need === 0 || eligibleCustomerIds.length === 0) {
    return { picks: [], rotationRound: currentRound }
  }

  const eligibleSet = new Set(eligibleCustomerIds)
  let round = currentRound
  let roundAssigned = new Set(roundAssignedIds)
  const todayAssigned = new Set(todayAssignedIds)
  const picks = []

  const shuffleWith = (arr) => {
    const out = [...arr]
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(randomFn() * (i + 1))
      const tmp = out[i]
      out[i] = out[j]
      out[j] = tmp
    }
    return out
  }

  while (picks.length < need) {
    if (eligibleSet.size === 0) {
      break
    }

    const candidates = [...eligibleSet].filter(
      (id) => !roundAssigned.has(id) && !todayAssigned.has(id) && !picks.includes(id),
    )

    if (candidates.length === 0) {
      const remainingToday = [...eligibleSet].filter((id) => !todayAssigned.has(id))
      if (remainingToday.length === 0) {
        break
      }
      round += 1
      roundAssigned = new Set()
      continue
    }

    const shuffled = shuffleWith(candidates)
    const take = Math.min(need - picks.length, shuffled.length)
    for (let i = 0; i < take; i += 1) {
      const id = shuffled[i]
      picks.push(id)
      roundAssigned.add(id)
      todayAssigned.add(id)
    }

    const remainingInRound = [...eligibleSet].filter(
      (id) => !roundAssigned.has(id) && !todayAssigned.has(id),
    )
    if (picks.length < need && remainingInRound.length === 0) {
      round += 1
      roundAssigned = new Set()
    }
  }

  return { picks, rotationRound: round }
}
