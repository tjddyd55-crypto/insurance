/** 에디터 상단 공개 토글 문구 SSOT — 공개 상태(is_published) 그대로 표시한다. */
export function advisorPublishToggleLabel(isPublished: boolean): '공개 ON' | '공개 OFF' {
  return isPublished ? '공개 ON' : '공개 OFF'
}
