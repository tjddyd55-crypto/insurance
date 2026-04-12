# 🎯 목표
Expo 앱 OTA 업데이트 (APK 재빌드 없이 업데이트)

# 1. 설치
npx expo install expo-updates

# 2. app.json 설정

{
  "expo": {
    "updates": {
      "url": "https://u.expo.dev/46c22c3a-0cf3-4a85-b877-908dab8116fe"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}

# 3. 업데이트 코드 추가

import * as Updates from 'expo-updates';

export async function checkUpdate() {
  try {
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (e) {
    console.log("업데이트 실패", e);
  }
}

# 4. 앱 시작 시 자동 실행

useEffect(() => {
  checkUpdate();
}, []);

# 5. OTA 배포

eas update --branch main --message "update"

# 6. 결과
- 앱 재설치 없이 업데이트 적용