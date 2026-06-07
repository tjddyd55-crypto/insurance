export type MapSdkErrorCode =
  | 'missing_client_id'
  | 'script_load_failed'
  | 'sdk_global_missing'
  | 'map_init_failed'
  | 'naver_auth_failure'
  | 'unsupported_provider'

export class MapSdkError extends Error {
  readonly code: MapSdkErrorCode

  constructor(code: MapSdkErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'MapSdkError'
    this.code = code
  }
}

export function mapSdkErrorMessage(code: MapSdkErrorCode): string {
  switch (code) {
    case 'missing_client_id':
      return '지도 설정이 필요합니다. 프론트 지도 Client ID를 확인해 주세요.'
    case 'naver_auth_failure':
      return '네이버 지도 인증에 실패했습니다. Web Service URL 또는 Dynamic Map 설정을 확인해 주세요.'
    case 'script_load_failed':
      return '지도를 불러오지 못했습니다. Static Map으로 대체합니다.'
    case 'sdk_global_missing':
      return '지도 SDK 초기화에 실패했습니다. Static Map으로 대체합니다.'
    case 'map_init_failed':
      return '지도를 표시하지 못했습니다. Static Map으로 대체합니다.'
    case 'unsupported_provider':
      return '지원하지 않는 지도 제공자입니다. Static Map으로 대체합니다.'
    default:
      return '지도를 불러오지 못했습니다. Static Map으로 대체합니다.'
  }
}

export function toMapSdkError(error: unknown): MapSdkError {
  if (error instanceof MapSdkError) {
    return error
  }
  if (error instanceof Error) {
    const known = error.message as MapSdkErrorCode
    if (
      known === 'missing_client_id' ||
      known === 'script_load_failed' ||
      known === 'sdk_global_missing' ||
      known === 'map_init_failed' ||
      known === 'naver_auth_failure' ||
      known === 'unsupported_provider'
    ) {
      return new MapSdkError(known)
    }
  }
  return new MapSdkError('script_load_failed')
}
