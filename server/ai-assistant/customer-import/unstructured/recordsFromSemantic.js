import { mapSemanticToImportFields } from '../../../../shared/ai-assistant/customer-import/unstructured/mapSemanticToImportFields.js'

/**
 * @param {import('../../../../shared/ai-assistant/customer-import/unstructured/semanticFieldExtract.js').UnstructuredSemanticRecord} semantic
 * @param {{ sourceCell: string, sourceText: string }} meta
 */
export function buildImportRecordsFromSemantic(semantic, meta) {
  const { sourceCell, sourceText } = meta
  if (semantic.phones.length === 0 && !semantic.personName) {
    return { kind: 'REVIEW_REQUIRED', records: [], sourceCell, sourceText, warnings: ['NO_NAME_OR_PHONE'] }
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
          sourceText,
          semanticFields: mappedResult.semanticFields,
        },
      ],
      sourceCell,
      sourceText,
    }
  }

  const records = semantic.phones.map((phone, index) => {
    const slice = {
      ...semantic,
      phones: [phone],
      personName: index === 0 ? semantic.personName : '',
      address: index === 0 ? semantic.address : '',
      detailAddress: index === 0 ? semantic.detailAddress : '',
      job: index === 0 ? semantic.job : '',
      company: index === 0 ? semantic.company : '',
      carNumber: index === 0 ? semantic.carNumber : '',
      carModel: index === 0 ? semantic.carModel : '',
      carYear: index === 0 ? semantic.carYear : '',
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
      sourceText,
      semanticFields: mappedResult.semanticFields,
    }
  })

  return { kind: 'MULTI_PERSON', records, sourceCell, sourceText }
}
