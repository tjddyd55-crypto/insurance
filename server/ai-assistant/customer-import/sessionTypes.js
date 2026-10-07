/**
 * @typedef {object} CustomerImportSession
 * @property {string} importSessionId
 * @property {string} userId
 * @property {number} gaId
 * @property {string} originalFileName
 * @property {'xlsx'|'xls'|'csv'} fileType
 * @property {Buffer} fileBuffer
 * @property {Array<{ name: string, matrix: unknown[][] }>} sheets
 * @property {string|null} selectedSheetName
 * @property {number|null} headerRowIndex
 * @property {string[]} headers
 * @property {Record<string, string>} columnMapping
 * @property {import('./pipeline.js').ImportPipelineRow[]} rows
 * @property {string|null} previewVersionHash
 * @property {'idle'|'preview_ready'|'committed'} commitStatus
 * @property {object|null} commitResult
 * @property {string|null} lastCommitIdempotencyKey
 * @property {string} createdAt
 * @property {number} expiresAt
 */

export {}
