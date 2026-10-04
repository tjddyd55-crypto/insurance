# Intent-first orchestration

## Flow

1. User message + conversation history + **IntentContextSnapshot** (trusted app state)
2. **classifyUserIntent** (GPT when enabled, else state-aware heuristic; GPT failure → heuristic)
3. **resolveTopLevelOrchestrationAction** — `GENERAL_CHAT` | unsupported ONE FC tool | `CUSTOMER_IMPORT` route
4. **resolveImportOrchestrationAction** (import-only policy: state overrides unsafe GPT stages)
5. ONE FC executes allowlisted tools / UI responses (no natural-language DB commit)

Customer import is **not** the default fallback when intent is unclear. General conversation uses **generateGeneralChatResponse**.

## GPT

- Goal, domain, stage, requestedAction, confidence
- No raw workbook, no customer PII, no DB execution

## ONE FC

- Auth, GA isolation, tool registry, confirmation, commit gate, idempotency

## Customer import commit

Preview → explicit **N명 등록** button → confirmation → commit only.

`stage=COMMIT_REQUEST` returns button guidance; **never** writes customers from chat text.
