export type PersonalBinderMaterial = {
  id: string
  fileId: number
  title: string
  originalFileName: string
  mimeType: string
  fileSize: number
  pageCount: number
  checksumSha256?: string | null
  sourceType?: 'personal' | 'official'
  binderCount?: number
  createdAt?: string
  updatedAt?: string
}

export type PersonalBinderItem = {
  id: string
  sectionId: string
  materialId: string
  sortOrder: number
  pageSelection: number[] | null
  material: PersonalBinderMaterial
  createdAt?: string
  updatedAt?: string
}

export type PersonalBinderSection = {
  id: string
  binderId: string
  title: string
  sortOrder: number
  items: PersonalBinderItem[]
  createdAt?: string
  updatedAt?: string
}

export type PersonalBinderSummary = {
  id: string
  title: string
  description: string
  sectionCount: number
  materialCount: number
  pageCount: number
  createdAt: string
  updatedAt: string
}

export type PersonalBinder = {
  id: string
  title: string
  description: string
  sections: PersonalBinderSection[]
  createdAt: string
  updatedAt: string
}

export type PersonalBinderViewerPage = {
  key: string
  sectionId: string
  sectionTitle: string
  itemId: string
  material: PersonalBinderMaterial
  pdfPageNumber: number
}
