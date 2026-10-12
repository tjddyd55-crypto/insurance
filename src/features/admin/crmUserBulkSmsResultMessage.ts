export type CrmUserBulkSmsResultCounts = {
  dryRun?: boolean
  campaign: {
    dryRun: boolean
    successCount: number
    failedCount: number
  }
}

export function formatCrmUserBulkSmsResultMessage(result: CrmUserBulkSmsResultCounts): string {
  if (result.dryRun || result.campaign.dryRun) {
    return '테스트 모드입니다. 실제 문자는 발송되지 않았습니다.'
  }
  const successCount = Number(result.campaign.successCount) || 0
  const failedCount = Number(result.campaign.failedCount) || 0
  if (successCount > 0 && failedCount === 0) {
    return `${successCount}명에게 문자 발송을 요청했습니다.`
  }
  if (successCount > 0 && failedCount > 0) {
    const totalCount = successCount + failedCount
    return `${totalCount}명 중 ${successCount}명 성공 / ${failedCount}명 실패`
  }
  return '문자 발송에 실패했습니다.'
}
