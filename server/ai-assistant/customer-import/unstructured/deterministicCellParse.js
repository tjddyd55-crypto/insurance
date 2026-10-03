import {
  cellToImportString,
  cellToImportStringPreserveLines,
} from '../../../../shared/ai-assistant/customer-import/normalize.js'
import { mapSemanticToImportFields } from '../../../../shared/ai-assistant/customer-import/unstructured/mapSemanticToImportFields.js'
import {
  extractPersonNameFromBlock,
  parseUnstructuredBlockToSemantic,
} from '../../../../shared/ai-assistant/customer-import/unstructured/semanticFieldExtract.js'

export { extractPersonNameFromBlock, parseUnstructuredBlockToSemantic }
import { redactSensitiveForExternalModel } from './sensitiveRedact.js'

/**
 * Deterministic unstructured cell parse:
 * raw block → semantic fields → ONE FC import field mapping (no raw-text fallbacks).
 *
 * @param {string} sheetName
 * @param {number} rowIndex
 * @param {number} colIndex
 * @param {unknown} cellValue
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

  if (semantic.phones.length === 0 && !semantic.personName) {
    return { kind: 'REVIEW_REQUIRED', records: [], sourceCell, sourceText: text, warnings: ['NO_NAME_OR_PHONE'] }
  }

  if (semantic.phones.length <= 1) {
    const mappedResult = mapSemanticToImportFields(semantic)
    return {
      kind: mappedResult.classification,
      records: [
        {
          sourceCell,
          sourceRecordIndex: 0,
          ...mappedResult.mapped,
          name: mappedResult.mapped.name ?? '',
          phone: mappedResult.mapped.phone ?? '',
          confidence: mappedResult.confidence,
          warnings: mappedResult.warnings,
          classification: mappedResult.classification,
          sourceText: text,
          semanticFields: mappedResult.semanticFields,
        },
      ],
      sourceCell,
      sourceText: text,
    }
  }

  const records = semantic.phones.map((phone, index) => {
    const slice = {
      ...semantic,
      phones: [phone],
      personName: index === 0 ? semantic.personName : '',
      address: index === 0 ? semantic.address : '',
      job: index === 0 ? semantic.job : '',
      carNumber: index === 0 ? semantic.carNumber : '',
      needsSemanticReview: true,
    }
    const mappedResult = mapSemanticToImportFields(slice)
    return {
      sourceCell,
      sourceRecordIndex: index,
      ...mappedResult.mapped,
      name: mappedResult.mapped.name ?? (index === 0 ? semantic.personName : ''),
      phone,
      confidence: 0.6,
      warnings: ['MULTI_PERSON_CELL', ...mappedResult.warnings],
      classification: 'REVIEW_REQUIRED',
      sourceText: text,
      semanticFields: mappedResult.semanticFields,
    }
  })

  return { kind: 'MULTI_PERSON', records, sourceCell, sourceText: text }
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
