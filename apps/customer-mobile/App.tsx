import { useEffect, useRef } from 'react'
import type { ElementRef } from 'react'
import { Alert, BackHandler, Linking, Platform, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as Updates from 'expo-updates'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import { AppLayout } from './AppLayout'

const CUSTOMER_HOME_URL = 'https://insurance-production-7bd8.up.railway.app/customer-app'
const SERVICE_HOST = new URL(CUSTOMER_HOME_URL).hostname

const WEBVIEW_ALWAYS_FRESH_PROPS = {
  cacheEnabled: false,
  cacheMode: 'LOAD_NO_CACHE' as const,
  incognito: true,
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
  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const update = await Updates.checkForUpdateAsync()
        if (!mounted || !update.isAvailable) {
          return
        }
        await Updates.fetchUpdateAsync()
        if (!mounted) {
          return
        }
        await Updates.reloadAsync()
      } catch {
        // OTA 확인 실패 시 앱 사용은 계속 진행한다.
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <AppLayout>
      <AppContent />
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
