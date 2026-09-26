/** Mobile Add/Edit full-screen form — single open-state SSOT */
export type CoverageSimulatorFormMode =
  | { type: 'add'; afterOrder: number }
  | { type: 'edit'; itemId: string }
  | null

export function isAddFormMode(
  mode: CoverageSimulatorFormMode,
): mode is { type: 'add'; afterOrder: number } {
  return mode !== null && mode.type === 'add'
}

export function isEditFormMode(
  mode: CoverageSimulatorFormMode,
): mode is { type: 'edit'; itemId: string } {
  return mode !== null && mode.type === 'edit'
}
