# ONE FC — Customer Ingestion Architecture (AI Secretary)

## Product principle

Users bring **their** data; ONE FC interprets it and maps to the **existing Customer DB/service**.  
The downloadable XLS sample (`customer-upload-sample.xlsx`) is a **legacy convenience format** for the classic customer Excel upload UI — **not** the AI Import schema SSOT.

```
User source (file, paste, chat — future)
  → Source adapter / parser (format-specific)
  → Structure analysis (TABULAR | UNSTRUCTURED_CELL_RECORDS | future modes)
  → Semantic interpretation (meaning per value: name, RRN, phone, address, …)
  → ONE FC field mapping (CUSTOMER_IMPORT_FIELD_KEYS only)
  → CustomerCandidate[]  (SSOT: ImportPipelineRow)
  → Shared pipeline: normalize → duplicate → validation → preview
  → User confirmation (UI gate)
  → insertCustomerForImport (existing service)
```

## CustomerCandidate SSOT

| Concern | Location |
|--------|----------|
| Row model | `server/ai-assistant/customer-import/pipeline.js` — `ImportPipelineRow` |
| Field keys | `shared/ai-assistant/customer-import/fieldDictionary.js` |
| Normalize / validate | `shared/ai-assistant/customer-import/normalize.js`, `validate.js` |
| View helper | `server/ai-assistant/customer-import/customerCandidate.js` |
| DB payload | `server/ai-assistant/customer-import/mapRowToCustomerBody.js` |

Supported `mapped` keys match `CUSTOMER_IMPORT_FIELD_KEYS` only. No new DB columns from AI convenience.

## Source modes (routing only)

- `TABULAR` — column headers + rows; alias map + optional GPT column-map for ambiguous headers.
- `UNSTRUCTURED_CELL_RECORDS` — semantic decomposition (`semanticFieldExtract.js`) → optional GPT semantic (`semanticGptService.js`, redacted block context only) → merge (`mergeSemanticWithGpt.js`) → `mapSemanticToImportFields.js` → shared pipeline. Deterministic locked fields are never overwritten by GPT. No raw workbook upload to OpenAI.

Modes are **not** user-facing requirements. New patterns get reusable analyzers, not one-off hacks.

## Deterministic + AI hybrid

- **Code**: phones, dates, RRN/account patterns, duplicates, validation, known header aliases.
- **GPT**: ambiguous column meaning, block semantics, multi-person ownership when unclear → `REVIEW_REQUIRED`.

## Legacy `/user/excel-data` (separate entry)

GA policy Excel (`ga_customer_excel_settings.sample_columns`) is **independent** of AI Import. Same Customer table may be linked via match rules; no shared schema with AI Import.

## Future inputs (not implemented)

| Source | Status | Adapter target |
|--------|--------|----------------|
| XLS/XLSX/CSV (AI) | IMPLEMENTED | file-analyze → pipeline |
| TEXT | NOT_STARTED | → CustomerCandidate[] |
| DOCX | NOT_STARTED | → CustomerCandidate[] |
| PDF | NOT_STARTED | → CustomerCandidate[] |
| CHAT_TEXT (`customer.create` NL) | NOT_STARTED (next phase) | GPT entities → CustomerCandidate[] |

All future sources must converge **before** normalize on the same pipeline.

## Chat direct create (next phase)

`홍길동 010… 고객 등록해줘` → intent/entities → **same** CustomerCandidate pipeline → preview → confirmation → create. No second write path.

## Pattern memory (future)

`customer.import.mapping-memory` — USER / GA / GLOBAL anonymized patterns only. Not in this phase.

## Production gates

See `PRODUCTION_GATES.md`: in-memory session/conversation/confirmation; `productionEnabled` stays off until persistent shared storage.
