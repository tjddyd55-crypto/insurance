# 🎯 목표
사용자가 직접 업데이트 버튼 누를 수 있도록 UI 추가

# 1. React 버튼 컴포넌트

import { checkUpdate } from "./update";

export default function UpdateButton() {
  return (
    <button onClick={checkUpdate}>
      업데이트 확인
    </button>
  );
}

# 2. Electron용 IPC 연결

renderer.ts

window.electronAPI.checkUpdate();

main.ts

ipcMain.handle("check-update", () => {
  autoUpdater.checkForUpdates();
});

# 3. UX 개선

- 업데이트 있음 → "업데이트 있음" 표시
- 다운로드 중 → 로딩 표시
- 완료 → "재시작 필요"

# 4. 선택 기능

- 자동 업데이트 ON/OFF 토글
- 강제 업데이트 (버전 체크)