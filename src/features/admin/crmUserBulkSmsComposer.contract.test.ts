import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildCrmUserBulkSmsSendBody } from './api/crmUserBulkSmsApi'
import { formatCrmUserBulkSmsResultMessage } from './crmUserBulkSmsResultMessage'

const composerPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'components/CrmUserBulkSmsComposerDialog.tsx',
)
const composerSource = readFileSync(composerPath, 'utf8')

describe('슈퍼어드민 사용자 단체문자 작성 다이얼로그', () => {
  it('발신번호 입력이 없고 제목, 내용, 발송 대상, 보내기만 둔다', () => {
    expect(composerSource.includes('발신번호')).toBe(false)
    expect(composerSource.includes('senderNumber')).toBe(false)
    expect(composerSource.includes('label="제목"')).toBe(true)
    expect(composerSource.includes('>내용<')).toBe(true)
    expect(composerSource.includes('발송 대상')).toBe(true)
    expect(composerSource.includes('보내기')).toBe(true)
    expect(composerSource.includes('발송 요청 완료')).toBe(false)
  })
})

describe('슈퍼어드민 사용자 단체문자 요청', () => {
  it('프론트 요청 본문에 sender 필드를 넣지 않는다', () => {
    const body = buildCrmUserBulkSmsSendBody({
      userIds: ['user-1', 'user-2'],
      message: '동일한 안내 본문',
      title: '서비스 안내',
      idempotencyKey: 'idem-1',
    })
    expect(Object.keys(body).sort()).toEqual([
      'confirm',
      'idempotencyKey',
      'message',
      'title',
      'userIds',
    ])
    expect(JSON.stringify(body).includes('sender')).toBe(false)
    expect(body.message).toBe('동일한 안내 본문')
    expect(body.title).toBe('서비스 안내')
    expect(body.userIds).toEqual(['user-1', 'user-2'])
  })
})

describe('슈퍼어드민 사용자 단체문자 결과 문구', () => {
  it('전원 성공', () => {
    expect(
      formatCrmUserBulkSmsResultMessage({
        dryRun: false,
        campaign: { dryRun: false, successCount: 2, failedCount: 0 },
      }),
    ).toBe('2명에게 문자 발송을 요청했습니다.')
  })

  it('일부 실패', () => {
    expect(
      formatCrmUserBulkSmsResultMessage({
        dryRun: false,
        campaign: { dryRun: false, successCount: 2, failedCount: 1 },
      }),
    ).toBe('3명 중 2명 성공 / 1명 실패')
  })

  it('전원 실패', () => {
    expect(
      formatCrmUserBulkSmsResultMessage({
        dryRun: false,
        campaign: { dryRun: false, successCount: 0, failedCount: 3 },
      }),
    ).toBe('문자 발송에 실패했습니다.')
  })

  it('dry-run은 성공 건수와 관계없이 테스트 모드 문구를 보여 준다', () => {
    expect(
      formatCrmUserBulkSmsResultMessage({
        dryRun: true,
        campaign: { dryRun: true, successCount: 0, failedCount: 0 },
      }),
    ).toBe('테스트 모드입니다. 실제 문자는 발송되지 않았습니다.')
  })
})
