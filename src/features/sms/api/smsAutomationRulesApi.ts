import { apiRequest } from '../../../lib/apiClient'
import type {
  SmsAutomationRule,
  SmsAutomationRuleInput,
  SmsAutomationRulePreview,
  SmsAutomationRunDetail,
  SmsAutomationRunResult,
} from '../types/smsAutomationRuleTypes'

function requireSmsToken(token: string): string {
  if (!token?.trim()) {
    throw new Error('로그인이 필요합니다.')
  }
  return token.trim()
}

export async function fetchSmsAutomationRules(token: string): Promise<SmsAutomationRule[]> {
  const raw = await apiRequest<SmsAutomationRule[]>('/api/sms/automation-rules', {
    token: requireSmsToken(token),
  })
  return Array.isArray(raw) ? raw : []
}

export async function createSmsAutomationRule(
  token: string,
  input: SmsAutomationRuleInput,
): Promise<SmsAutomationRule> {
  return apiRequest<SmsAutomationRule>('/api/sms/automation-rules', {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateSmsAutomationRule(
  token: string,
  ruleId: number,
  input: Partial<SmsAutomationRuleInput>,
): Promise<SmsAutomationRule> {
  return apiRequest<SmsAutomationRule>(`/api/sms/automation-rules/${ruleId}`, {
    token: requireSmsToken(token),
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteSmsAutomationRule(token: string, ruleId: number): Promise<void> {
  await apiRequest<unknown>(`/api/sms/automation-rules/${ruleId}`, {
    token: requireSmsToken(token),
    method: 'DELETE',
  })
}

export async function previewSmsAutomationRule(
  token: string,
  ruleId: number,
  baseDate?: string,
): Promise<SmsAutomationRulePreview> {
  return apiRequest<SmsAutomationRulePreview>(`/api/sms/automation-rules/${ruleId}/preview`, {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify(baseDate ? { baseDate } : {}),
  })
}

export async function runSmsAutomationRule(
  token: string,
  ruleId: number,
  options?: { baseDate?: string; realSend?: boolean },
): Promise<SmsAutomationRunResult> {
  return apiRequest<SmsAutomationRunResult>(`/api/sms/automation-rules/${ruleId}/run`, {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify({
      baseDate: options?.baseDate,
      realSend: options?.realSend === true,
    }),
  })
}

export async function fetchSmsAutomationRunDetail(
  token: string,
  runId: number,
): Promise<SmsAutomationRunDetail> {
  return apiRequest<SmsAutomationRunDetail>(`/api/sms/automation-runs/${runId}`, {
    token: requireSmsToken(token),
  })
}
