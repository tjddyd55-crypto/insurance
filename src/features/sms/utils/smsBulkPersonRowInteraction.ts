import type { KeyboardEvent, MouseEvent } from 'react'

export type SmsBulkPersonRowInteractionHandlers = {
  handleRowClick: () => void
  handleCheckboxClick: (event: MouseEvent<HTMLInputElement>) => void
  handleCheckboxChange: () => void
  handleRowKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

export function createSmsBulkPersonRowHandlers(
  onToggle: () => void,
  disabled?: boolean,
): SmsBulkPersonRowInteractionHandlers {
  const toggleIfEnabled = () => {
    if (disabled) return
    onToggle()
  }

  return {
    handleRowClick: toggleIfEnabled,
    handleCheckboxClick: (event) => {
      event.stopPropagation()
    },
    handleCheckboxChange: toggleIfEnabled,
    handleRowKeyDown: (event) => {
      if (disabled) return
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onToggle()
    },
  }
}
