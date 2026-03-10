interface KakaoSharePayload {
  objectType: 'feed'
  content: {
    title: string
    description: string
    imageUrl: string
    link: {
      mobileWebUrl: string
      webUrl: string
    }
  }
  buttons: Array<{
    title: string
    link: {
      mobileWebUrl: string
      webUrl: string
    }
  }>
}

interface KakaoClient {
  init: (appKey: string) => void
  isInitialized: () => boolean
  Share: {
    sendDefault: (payload: KakaoSharePayload) => void
  }
}

declare global {
  interface Window {
    Kakao?: KakaoClient
  }
}

type ShareMethod = 'kakao' | 'web-share-file' | 'web-share' | 'clipboard'

const KAKAO_SDK_URL = 'https://developers.kakao.com/sdk/js/kakao.min.js'

function buildResultUrl(recordId: string): string {
  return `${window.location.origin}/applications/${recordId}/result`
}

function loadKakaoScript(): Promise<void> {
  if (window.Kakao) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${KAKAO_SDK_URL}"]`,
    )

    if (existingScript) {
      if (window.Kakao) {
        resolve()
        return
      }

      existingScript.addEventListener('load', () => resolve())
      existingScript.addEventListener('error', () =>
        reject(new Error('카카오 SDK를 불러오지 못했습니다.')),
      )
      return
    }

    const script = document.createElement('script')
    script.src = KAKAO_SDK_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했습니다.'))
    document.head.appendChild(script)
  })
}

async function shareWithKakao(
  recordId: string,
  title: string,
  description: string,
): Promise<boolean> {
  const appKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY as string | undefined
  if (!appKey) {
    return false
  }

  await loadKakaoScript()

  const kakao = window.Kakao
  if (!kakao) {
    return false
  }

  if (!kakao.isInitialized()) {
    kakao.init(appKey)
  }

  const shareUrl = buildResultUrl(recordId)
  kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title,
      description,
      imageUrl:
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
      link: {
        mobileWebUrl: shareUrl,
        webUrl: shareUrl,
      },
    },
    buttons: [
      {
        title: '신청서 확인하기',
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
    ],
  })

  return true
}

async function shareWithWebShare(
  recordId: string,
  title: string,
  description: string,
): Promise<boolean> {
  if (!navigator.share) {
    return false
  }

  const shareUrl = buildResultUrl(recordId)
  await navigator.share({
    title,
    text: description,
    url: shareUrl,
  })
  return true
}

function canShareFiles(): boolean {
  return typeof navigator.canShare === 'function'
}

async function shareWithWebShareFile(
  recordId: string,
  title: string,
  description: string,
  file: File,
): Promise<boolean> {
  if (!navigator.share || !canShareFiles()) {
    return false
  }

  const shareUrl = buildResultUrl(recordId)
  const isFileShareSupported = navigator.canShare({ files: [file] })
  if (!isFileShareSupported) {
    return false
  }

  await navigator.share({
    title,
    text: description,
    url: shareUrl,
    files: [file],
  })
  return true
}

async function copyLink(recordId: string): Promise<void> {
  const shareUrl = buildResultUrl(recordId)
  if (!navigator.clipboard) {
    throw new Error('공유 링크 복사를 지원하지 않는 환경입니다.')
  }

  await navigator.clipboard.writeText(shareUrl)
}

export async function shareResult(
  recordId: string,
  title: string,
  fileForShare?: File,
): Promise<ShareMethod> {
  const description = '자동차 보험 신청서 결과문을 확인하세요.'

  if (fileForShare) {
    const sharedWithFile = await shareWithWebShareFile(
      recordId,
      title,
      description,
      fileForShare,
    )
    if (sharedWithFile) {
      return 'web-share-file'
    }
  }

  const kakaoShared = await shareWithKakao(recordId, title, description)
  if (kakaoShared) {
    return 'kakao'
  }

  const webShared = await shareWithWebShare(recordId, title, description)
  if (webShared) {
    return 'web-share'
  }

  await copyLink(recordId)
  return 'clipboard'
}
