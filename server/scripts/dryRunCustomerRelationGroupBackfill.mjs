/**
 * 기존 customer_relations 1:1 페어를 connected component 로 묶어
 * 연계 그룹 backfill 후보를 추정하는 dry-run 전용 스크립트 초안.
 *
 * 실행 금지(자동 실행 없음). 별도 승인 후에만 --apply 검토.
 * 사용 예:
 *   node server/scripts/dryRunCustomerRelationGroupBackfill.mjs
 *
 * 이 스크립트는 DB에 INSERT/UPDATE/DELETE 를 하지 않는다.
 */
import process from 'node:process'

console.log(
  [
    '[dry-run] customer relation group backfill draft',
    '- 실제 DB 변환은 하지 않습니다.',
    '- develop 검증·사용자 승인 후에만 구현/실행하세요.',
    '- 권장: undirected pair 를 connected component 로 묶어 그룹 후보를 산출.',
    '- pair 별 1그룹 생성은 금지(기존 문제 반복).',
  ].join('\n'),
)

process.exit(0)
