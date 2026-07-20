export type BoardWriterNavItem = {
  label: string
  path: string
}

export type BoardWriterNavLabels = {
  title: string
  viewLabel: string
  uploadLabel: string
}

type BoardWriterNavBoard = {
  label: string
  boardScope: string
}

export function buildBoardWriterNavPaths(boardSlug: string) {
  const encoded = encodeURIComponent(boardSlug.trim())
  const viewPath = `/board-writer/boards/${encoded}/news`
  return {
    viewPath,
    uploadPath: `${viewPath}/upload`,
  }
}

export function buildBoardWriterNavLabels(board: BoardWriterNavBoard): BoardWriterNavLabels {
  const name = String(board.label ?? '').trim() || '소식지'
  if (board.boardScope === 'global') {
    return {
      title: name,
      viewLabel: '공용 소식지 조회',
      uploadLabel: '공용 소식지 업로드',
    }
  }
  // GA전용 등: 메뉴/탭 표시는 생성 이름 그대로 (suffix 금지)
  return {
    title: name,
    viewLabel: name,
    uploadLabel: `${name} 업로드`,
  }
}

export function buildBoardWriterNavItems(board: BoardWriterNavBoard, boardSlug: string): BoardWriterNavItem[] {
  const labels = buildBoardWriterNavLabels(board)
  const paths = buildBoardWriterNavPaths(boardSlug)
  return [
    { label: labels.viewLabel, path: paths.viewPath },
    { label: labels.uploadLabel, path: paths.uploadPath },
  ]
}
