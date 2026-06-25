/**
 * 공용/GA 소식지 메타데이터(label, description) PATCH 파싱·검증.
 * slug/path는 변경하지 않는다.
 */
export function parseBoardMetadataPatch(body) {
  const src = body && typeof body === 'object' ? body : {}
  const hasLabel = src.label != null || src.name != null
  const labelRaw = src.label ?? src.name

  if (hasLabel) {
    const label = String(labelRaw ?? '').trim()
    if (!label) {
      return { ok: false, status: 400, message: '소식지명을 입력해 주세요.' }
    }
    if (label.length > 40) {
      return { ok: false, status: 400, message: '소식지명은 40자 이하로 입력해 주세요.' }
    }
  }

  let description
  if (src.description !== undefined) {
    description = src.description == null ? null : String(src.description).trim() || null
  }

  return {
    ok: true,
    label: hasLabel ? String(labelRaw).trim() : null,
    description,
  }
}
