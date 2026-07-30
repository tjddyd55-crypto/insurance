const PC_STEPS = [
  '위의 PC 다운로드 버튼을 눌러 설치 파일을 다운로드한다.',
  '다운로드된 파일을 실행한다.',
  '설치 화면 안내에 따라 설치를 진행한다.',
  '설치 완료 후 프로그램을 실행한다.',
  '로그인 후 사용한다.',
]

const ANDROID_STEPS = [
  '위의 안드로이드 다운로드 버튼을 눌러 Google Play로 이동한다.',
  'Google Play에서 ONE FC 앱을 설치한다.',
  '설치 완료 후 앱을 실행한다.',
  '로그인 후 사용한다.',
]

export function InstallGuide() {
  return (
    <section className="intro-card">
      <h2 className="intro-section-title">설치 방법 안내</h2>

      <div className="intro-guide-block">
        <h3 className="intro-guide-title">PC 설치 방법</h3>
        <ol className="intro-steps">
          {PC_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="intro-alert-box">
          회사 또는 PC 보안 설정에 따라 실행 확인 창이 나올 수 있습니다.
          <br />
          이 경우 계속 실행 또는 허용 후 설치를 진행하세요.
        </div>
      </div>

      <div className="intro-guide-block">
        <h3 className="intro-guide-title">안드로이드 앱 설치 방법</h3>
        <ol className="intro-steps">
          {ANDROID_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="intro-alert-box intro-alert-box--strong">
          Google Play에서 ONE FC(com.onefc.app)를 설치합니다.
        </div>
      </div>
    </section>
  )
}
