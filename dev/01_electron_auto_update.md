# 🎯 목표
Electron 앱에 자동 업데이트 기능 추가 (GitHub Release 기반)

# 1. 패키지 설치
npm install electron-updater electron-builder

# 2. package.json 수정
{
  "version": "1.0.0",
  "build": {
    "appId": "com.insurance.app",
    "publish": [
      {
        "provider": "github",
        "owner": "tjddyd55-crypto",
        "repo": "insurance"
      }
    ]
  }
}

# 3. Electron main.ts 수정

import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  mainWindow.loadURL("http://localhost:3000");
}

app.whenReady().then(() => {
  createWindow();

  // 자동 업데이트 체크
  autoUpdater.checkForUpdatesAndNotify();
});

# 4. 업데이트 이벤트 처리

autoUpdater.on("update-available", () => {
  console.log("업데이트 있음");
});

autoUpdater.on("update-downloaded", () => {
  console.log("업데이트 다운로드 완료");
  autoUpdater.quitAndInstall();
});

# 5. 수동 업데이트 함수 추가

export function checkForUpdatesManual() {
  autoUpdater.checkForUpdates();
}

# 6. 빌드 및 배포

npm run build

# 7. 결과
- GitHub Release에 자동 업로드
- 앱 실행 시 자동 업데이트