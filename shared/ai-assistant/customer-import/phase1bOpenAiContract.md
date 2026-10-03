# Phase 1B — OpenAI column-map 입력 계약 (구현 전 SSOT)

## 모델에 제공할 최소 File Context

```json
{
  "importSessionId": "uuid",
  "selectedSheetName": "string",
  "headerRowIndex": 0,
  "headers": ["이름", "휴대폰번호", "..."],
  "sampleRows": [{ "sourceRowNumber": 4, "cells": ["김철수", "010-..."] }],
  "sheetStats": { "rowCount": 120, "columnCount": 8, "emptyRowRatio": 0.02 },
  "availableFields": [{ "key": "name", "label": "이름", "required": true }],
  "existingAliasHints": { "성명": "name", "H.P": "phone" }
}
```

전체 Excel 원본·수천 행은 전송하지 않는다.

## GPT Mapping 응답 JSON Schema (후보)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["mappings"],
  "properties": {
    "mappings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["sourceColumn", "destinationField", "confidence"],
        "properties": {
          "sourceColumn": { "type": "string" },
          "destinationField": { "type": "string", "enum": ["name", "phone", "ssn", "address", "memo", "..."] },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "reason": { "type": "string", "maxLength": 500 }
        }
      }
    }
  }
}
```

`customer.import.column-map` Tool은 위 응답을 검증한 뒤 Import Session `columnMapping`에 반영한다.
