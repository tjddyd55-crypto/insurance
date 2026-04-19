import type { PropsWithChildren } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['bottom']}>
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f1115',
  },
})
