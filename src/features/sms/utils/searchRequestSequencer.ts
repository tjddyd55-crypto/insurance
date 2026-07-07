/**
 * 비동기 검색 요청의 순서를 보장하기 위한 순수 유틸.
 *
 * 문제: 검색 요청 A(느림) 시작 → 초기화 요청 B(빠름) 시작 → B 응답 먼저 적용 →
 *       뒤늦게 도착한 A 응답이 최신 상태(B)를 덮어써 이전 결과가 되살아난다.
 *
 * 해결: 요청 시작 시 begin()으로 순번을 발급하고, 응답을 반영하기 직전 isLatest()로
 *       "내가 아직 최신 요청인가"를 확인한다. 최신이 아니면 응답을 버린다.
 *
 * React 상태나 DOM에 의존하지 않으므로 단독으로 단위 테스트할 수 있다.
 */
export interface SearchRequestSequencer {
  /** 새 요청을 시작하고 그 순번을 반환한다. 순번은 호출마다 단조 증가한다. */
  begin(): number
  /** 주어진 순번이 현재까지 발급된 것 중 가장 최신인지 반환한다. */
  isLatest(requestId: number): boolean
}

export function createSearchRequestSequencer(): SearchRequestSequencer {
  let latest = 0
  return {
    begin() {
      latest += 1
      return latest
    },
    isLatest(requestId: number) {
      return requestId === latest
    },
  }
}
