import { useEffect, useRef, useState } from 'react'
import type { ElementRef } from 'react'
import { Alert, BackHandler, Linking, Platform, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as Updates from 'expo-updates'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import { AppLayout } from './AppLayout'
import { ExpoUpdateOverlay, type ExpoUpdatePhase } from './components/ExpoUpdateOverlay'

const CUSTOMER_HOME_URL = 'https://insurance-production-7bd8.up.railway.app/customer-app'
const SERVICE_HOST = new URL(CUSTOMER_HOME_URL).hostname

/**
 * incognito 를 켜면(특히 Android WebView) localStorage/DOM Storage 가 세션 단위로 격리되거나
 * 쓰기가 반영되지 않는 경우가 있어, 고객앱(/customer-app) 세션(customerAppSession)이 남지 않고
 * 홈·연결 화면이 깨지는 문제가 발생할 수 있다. 캐시 무효화만 유지하고 비시크릿 컨텍스트를 쓴다.
 */
const WEBVIEW_ALWAYS_FRESH_PROPS = {
  cacheEnabled: false,
  cacheMode: 'LOAD_NO_CACHE' as const,
  incognito: false,
}

const WEB_FETCH_BYPASS_CACHE_HEADERS = {
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
}

type MainWebViewLoadRequest = WebViewNavigation & { isTopFrame?: boolean }

function looksLikeFileDownload(url: string): boolean {
  const lower = url.toLowerCase()
  return lower.includes('.pdf') || lower.includes('/download')
}

async function openExternal(url: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url)
    if (!supported) return false
    await Linking.openURL(url)
    return true
  } catch {
    return false
  }
}

function AppContent() {
  const insets = useSafeAreaInsets()
  const webViewRef = useRef<ElementRef<typeof WebView>>(null)
  const canGoBackRef = useRef(false)
  const currentUrlRef = useRef('')

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const currentUrl = currentUrlRef.current
      if (currentUrl.includes('/customer-app') && !canGoBackRef.current) {
        Alert.alert('앱을 종료하시겠습니까?', '', [
          { text: '취소', style: 'cancel' },
          { text: '확인', onPress: () => BackHandler.exitApp() },
        ])
        return true
      }
      if (canGoBackRef.current && webViewRef.current) {
        webViewRef.current.goBack()
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [])

  const mainWebPaddingTop = Platform.OS === 'ios' ? Math.max(0, insets.top - 7) : Math.max(0, insets.top - 4)

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0f1115" />
      <View style={[styles.mainWebWrap, { paddingTop: mainWebPaddingTop }]}>
        <WebView
          ref={webViewRef}
          source={{ uri: CUSTOMER_HOME_URL, headers: WEB_FETCH_BYPASS_CACHE_HEADERS }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          {...WEBVIEW_ALWAYS_FRESH_PROPS}
          onShouldStartLoadWithRequest={(request: MainWebViewLoadRequest) => {
            const requestUrl = request.url
            const lower = requestUrl.toLowerCase()
            if (lower.startsWith('tel:') || lower.startsWith('mailto:') || looksLikeFileDownload(requestUrl)) {
              void openExternal(requestUrl)
              return false
            }
            try {
              const parsed = new URL(requestUrl)
              if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true
              if (parsed.hostname.toLowerCase() !== SERVICE_HOST.toLowerCase()) {
                void openExternal(requestUrl)
                return false
              }
            } catch {
              return true
            }
            return true
          }}
          onNavigationStateChange={(nav) => {
            currentUrlRef.current = nav.url ?? ''
            canGoBackRef.current = nav.canGoBack
          }}
        />
      </View>
    </View>
  )
}

export default function App() {
  /*
   * OTA 단계 상태.
   * on-launch 에서 체크 → 다운로드 → 리로드까지 자동으로 진행되며,
   * ExpoUpdateOverlay 가 downloading/reloading 구간에서만 풀스크린 안내를 보여 준다.
   * 사용자가 "왜 갑자기 앱이 재시작됐는지" 모르는 현상을 막는 것이 핵심 목적.
   */
  const [updatePhase, setUpdatePhase] = useState<ExpoUpdatePhase>('idle')

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        if (!Updates.isEnabled) return
        setUpdatePhase('checking')
        const update = await Updates.checkForUpdateAsync()
        if (!mounted) return
        if (!update.isAvailable) {
          setUpdatePhase('idle')
          return
        }
        setUpdatePhase('downloading')
        await Updates.fetchUpdateAsync()
        if (!mounted) return
        setUpdatePhase('reloading')
        await Updates.reloadAsync()
      } catch {
        /* OTA 확인 실패 시 앱 사용은 계속 진행한다. 오버레이도 숨긴다. */
        if (mounted) setUpdatePhase('error')
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <AppLayout>
      <AppContent />
      <ExpoUpdateOverlay phase={updatePhase} />
    </AppLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1115',
  },
  webview: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: '#0f1115',
  },
  mainWebWrap: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: '#0f1115',
  },
})
