/**
 * pdfjs-dist 워커 초기화 — Single Source of Truth.
 *
 * 왜 이 파일이 존재하는가:
 *   이전에는 PDF 를 쓰는 각 컴포넌트가 개별적으로
 *     GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/.../pdf.worker.min.mjs',
 *                                              import.meta.url).toString()
 *   식으로 초기화했다. 이 방식은 웹(HTTPS)에선 정상이지만, Electron 빌드
 *   (file://) 에서 Vite 가 박는 `/assets/pdf.worker-<hash>.mjs` 절대경로가
 *   "디스크 루트" 로 해석되어 워커 파일을 찾지 못한다. 결과적으로
 *   getDocument().promise 가 즉시 reject → 사용자는 "PDF 를 표시하지 못했습니다"
 *   만 보게 된다. 웹에선 문제가 드러나지 않아 오래 방치되기 쉬운 버그다.
 *
 * 왜 `?worker` 인가:
 *   Vite 가 해당 파일을 워커용 청크로 번들하고 `new Worker(...)` 인스턴스를
 *   직접 만들어 준다. URL 해석 단계가 통째로 사라지므로 file:// / https://
 *   양쪽 모두에서 동일하게 동작한다.
 *
 * 호출 규약:
 *   - 앱 부트 또는 PDF 를 쓰는 컴포넌트 모듈 최상위에서 한 번만 호출하면 된다.
 *   - 여러 번 호출돼도 안전하다(중복 초기화 가드).
 *   - SSR 환경이 들어올 수 있는 자리라 window 존재 여부를 확인한다.
 */

import { GlobalWorkerOptions } from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'

let initialized = false

export function setupPdfWorker(): void {
  if (initialized) return
  if (typeof window === 'undefined') return
  /*
   * workerPort 를 직접 주입하면 pdfjs 는 내부에서 워커 URL 을 스스로 해석할
   * 필요가 없다. 이 경로가 Electron/웹 차이를 제거하는 핵심이다.
   */
  GlobalWorkerOptions.workerPort = new PdfWorker()
  initialized = true
}
