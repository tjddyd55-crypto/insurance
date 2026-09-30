import type { InlineAmountField } from '../components/center-timeline/InlineAmountQuickEdit'

export type ActiveInlineEdit =
  | { kind: 'amount'; itemId: string; field: InlineAmountField }
  | { kind: 'title'; itemId: string }
  | null

/** @deprecated use ActiveInlineEdit */
export type InlineAmountEditTarget = Extract<ActiveInlineEdit, { kind: 'amount' }> | null

export function isAmountInlineEdit(
  target: ActiveInlineEdit,
): target is Extract<ActiveInlineEdit, { kind: 'amount' }> {
  return target?.kind === 'amount'
}

export function shouldCommitInlineBeforeNextEdit(
  active: ActiveInlineEdit,
  next: ActiveInlineEdit,
): boolean {
  if (!active || !next) return false
  if (active.itemId !== next.itemId || active.kind !== next.kind) return true
  if (active.kind === 'amount' && next.kind === 'amount') {
    return active.field !== next.field
  }
  return false
}

export function commitRegisteredInlineEdit(registry: { current: (() => void) | null }): boolean {
  if (!registry.current) return false
  registry.current()
  return true
}
