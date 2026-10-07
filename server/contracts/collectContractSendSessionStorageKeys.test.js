import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectContractFileIdsFromRows,
  collectContractSendSessionStorageKeys,
  parseContractFileId,
} from './collectContractSendSessionStorageKeys.js'

test('parseContractFileId accepts numeric ids only', () => {
  assert.equal(parseContractFileId('123'), '123')
  assert.equal(parseContractFileId('abc'), null)
  assert.equal(parseContractFileId(null), null)
})

test('collectContractSendSessionStorageKeys keeps session-scoped contract paths only', () => {
  const keys = collectContractSendSessionStorageKeys('css_abc', [
    'contracts/css_abc/documents/doc1/signed.pdf',
    'contracts/send-attachments/user1/uuid/file.pdf',
    'customers/123/original.pdf',
    'contracts/other-session/documents/doc1/signed.pdf',
  ])
  assert.deepEqual(keys.sort(), [
    'contracts/css_abc/documents/doc1/signed.pdf',
    'contracts/send-attachments/user1/uuid/file.pdf',
  ])
})

test('collectContractFileIdsFromRows gathers file id columns', () => {
  const ids = collectContractFileIdsFromRows([
    { file_id: '10', signed_pdf_file_id: '20' },
    { value_file_id: '30', signature_file_id: 'bad' },
  ])
  assert.deepEqual(ids.sort(), ['10', '20', '30'])
})
