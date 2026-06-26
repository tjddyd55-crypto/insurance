export type MemoFontWeight = 'normal' | 'bold'

export interface Note {
  id: string
  content: string
  x: number
  y: number
  zIndex?: number
  width?: number
  height?: number
  fontSize?: number
  fontWeight?: MemoFontWeight
}
