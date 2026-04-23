/**
 * pdfjs worker 스레드 전용 엔트리.
 *
 * 이 파일의 유일한 책임:
 *   1) 워커 스레드에서 먼저 Uint8Array.prototype 폴리필을 활성화한다.
 *   2) 그 뒤에 pdfjs-dist 의 실제 worker 코드를 side-effect import 로 로드한다.
 *
 * 왜 별도 엔트리가 필요한가:
 *   `pdfjs-dist/build/pdf.worker.min.mjs` 를 바로 `?worker` 로 import 하면
 *   pdfjs 코드가 즉시 최상위에서 실행되어 폴리필을 먼저 심을 틈이 없다.
 *   워커의 Uint8Array.prototype 은 메인 스레드와 분리된 별도 realm 이라
 *   메인에서 아무리 폴리필해도 워커에는 전파되지 않는다.
 *
 *   이 파일을 `?worker` 대상으로 삼으면 Vite 가 이 파일을 워커 엔트리로
 *   번들하면서 위 두 import 를 순서대로 실행시킨다. 결과적으로 워커가
 *   pdfjs worker 로직을 만나기 전에 toHex/toBase64/fromBase64 가 준비된다.
 *
 * 이후 변경은 어디에서?
 *   - 폴리필 자체는 `src/lib/polyfills/uint8ArrayBase.ts`.
 *   - pdfjs 버전을 바꿀 일이 있으면 아래 두 번째 import 의 경로만 맞추면 된다.
 */

import '../polyfills/uint8ArrayBase'
import 'pdfjs-dist/build/pdf.worker.min.mjs'
