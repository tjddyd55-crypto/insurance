import { describe, expect, it } from 'vitest'

import {
  filterItemsByFolderSelection,
  folderIdForUpload,
} from './personalBinderFolderFilter'

describe('personalBinderFolderFilter', () => {
  const items = [
    { id: '1', folderId: null },
    { id: '2', folderId: '10' },
    { id: '3', folderId: '10' },
  ]

  it('filters all and uncategorized', () => {
    expect(filterItemsByFolderSelection(items, 'all')).toHaveLength(3)
    expect(filterItemsByFolderSelection(items, 'uncategorized')).toEqual([{ id: '1', folderId: null }])
    expect(filterItemsByFolderSelection(items, '10')).toHaveLength(2)
  })

  it('maps upload folder from selection', () => {
    expect(folderIdForUpload('all')).toBeNull()
    expect(folderIdForUpload('uncategorized')).toBeNull()
    expect(folderIdForUpload('42')).toBe('42')
  })
})
