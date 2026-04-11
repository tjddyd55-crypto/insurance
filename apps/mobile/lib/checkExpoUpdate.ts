import { Alert } from 'react-native'
import * as Updates from 'expo-updates'
import { sendClientLog } from './sendClientLog'

export async function checkExpoUpdate(
  showAlert: (ready: boolean) => void,
  options?: { disableOTA?: boolean },
): Promise<boolean> {
  if (options?.disableOTA) {
    showAlert(false)
    return false
  }
  try {
    if (!Updates.isEnabled) {
      showAlert(false)
      return false
    }
    const update = await Updates.checkForUpdateAsync()
    console.log('update check:', update)
    void sendClientLog({
      type: 'expo-update-check',
      isAvailable: update.isAvailable,
      reason: update.reason ?? null,
    })
    const available = Boolean(update.isAvailable)
    showAlert(available)
    return available
  } catch (e) {
    console.log('expo update error:', e)
    void sendClientLog({
      type: 'expo-update-error',
      error: String(e),
    })
    showAlert(false)
    return false
  }
}

export async function applyExpoUpdate(options?: { disableOTA?: boolean }): Promise<void> {
  if (options?.disableOTA) {
    void sendClientLog({ type: 'expo-ota-skipped', reason: 'disableOTA' })
    Alert.alert(
      '\uC54C\uB9BC',
      'OTA\uAC00 \uC77C\uC2DC \uC911\uB2E8\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC2A4\uD1A0\uC5B4\uC5D0\uC11C \uCD5C\uC2E0 \uC571\uC744 \uC124\uCE58\uD574 \uC8FC\uC138\uC694.',
    )
    return
  }
  try {
    await Updates.fetchUpdateAsync()
    void sendClientLog({ type: 'expo-update-fetched' })
    await Updates.reloadAsync()
  } catch (e) {
    console.log('OTA failed, attempting reload rollback:', e)
    void sendClientLog({ type: 'expo-update-apply-error', error: String(e) })
    try {
      await Updates.reloadAsync()
    } catch (err) {
      console.log('expo rollback reload failed:', err)
      void sendClientLog({
        type: 'expo-update-rollback-failed',
        error: String(err),
      })
      Alert.alert(
        '\uC54C\uB9BC',
        '\uC571 \uC7AC\uC124\uCE58\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.',
      )
    }
  }
}
