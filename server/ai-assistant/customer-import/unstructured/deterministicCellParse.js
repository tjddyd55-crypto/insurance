import { cellToImportStringPreserveLines } from '../../../../shared/ai-assistant/customer-import/normalize.js'
import { parseUnstructuredBlockToSemantic } from '../../../../shared/ai-assistant/customer-import/unstructured/semanticFieldExtract.js'
import { cellToImportString } from '../../../../shared/ai-assistant/customer-import/normalize.js'
import { redactSensitiveForExternalModel } from './sensitiveRedact.js'
import { buildImportRecordsFromSemantic } from './recordsFromSemantic.js'

export {
  extractPersonNameFromBlock,
  parseUnstructuredBlockToSemantic,
} from '../../../../shared/ai-assistant/customer-import/unstructured/semanticFieldExtract.js'

/**
 * Deterministic-only cell parse (no GPT). GPT enrichment runs in unstructuredExtractService.
 */
export function parseUnstructuredCellDeterministic(sheetName, rowIndex, colIndex, cellValue) {
  const text = cellToImportStringPreserveLines(cellValue)
  if (!text.trim()) {
    return { kind: 'EMPTY', records: [], sourceText: text }
  }
  const cellRef = `${columnIndexToLetters(colIndex)}${rowIndex + 1}`
  const sourceCell = `${sheetName}!${cellRef}`

  if (/^(경정청구|보험|메모|계좌)/.test(text) && !/01[016789]/.test(text) && !/이름|성명|고객명/.test(text)) {
    return { kind: 'NON_CUSTOMER', records: [], sourceCell, sourceText: text }
  }

  const semantic = parseUnstructuredBlockToSemantic(text)
  return buildImportRecordsFromSemantic(semantic, { sourceCell, sourceText: text })
}

export function prepareCellForGpt(sheetName, rowIndex, colIndex, cellValue) {
  const text = cellToImportString(cellValue)
  const { redactedText } = redactSensitiveForExternalModel(text)
  const cellRef = `${columnIndexToLetters(colIndex)}${rowIndex + 1}`
  return {
    sourceCell: `${sheetName}!${cellRef}`,
    redactedText: redactedText.slice(0, 2000),
  }
}

function columnIndexToLetters(index) {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
