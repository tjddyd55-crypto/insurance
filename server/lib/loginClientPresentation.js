export function classifyLoginClient(userAgent) {
  const ua = String(userAgent ?? '').trim()
  if (!ua) return { channel: '미확인', device: '미확인' }
  const lower = ua.toLowerCase()
  const channel = /electron\//i.test(ua)
    ? 'ELECTRON'
    : /(onefc|reactnative| okhttp\/|expo\/)/i.test(ua)
      ? 'NATIVE'
      : /android|iphone|ipad|ipod|mobile/i.test(ua)
        ? 'MOBILE_WEB'
        : 'PC_WEB'
  const platform = /windows/i.test(ua)
    ? 'Windows PC'
    : /android/i.test(ua)
      ? 'Android'
      : /iphone|ipod/i.test(ua)
        ? 'iPhone'
        : /ipad/i.test(ua)
          ? 'iPad'
          : /macintosh|mac os/i.test(ua)
            ? 'Mac'
            : /linux/i.test(ua)
              ? 'Linux PC'
              : '기타 기기'
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /crios|chrome\//i.test(ua)
      ? 'Chrome'
      : /firefox\//i.test(ua)
        ? 'Firefox'
        : /safari\//i.test(ua)
          ? 'Safari'
          : /electron\//i.test(ua)
            ? 'Electron'
            : ''
  return { channel, device: browser ? `${platform} · ${browser}` : platform }
}
