/** Dev-only: node scripts/qa/account-a4-print-check.mjs
 * Open http://localhost:3099/__account-a4-check?life=19&non=12&real=1&orient=portrait
 * Uses ONLY fake data and the production print component/CSS. Browser print
 * preview (Ctrl+P) verifies the chosen orientation, one page, full wrapping and no app shell.
 * Not imported by any application route or production entry.
 */
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true } })
const http = createHttpServer(async (req, res) => {
  if (!req.url?.startsWith('/__account-a4-check')) {
    server.middlewares(req, res, () => { res.statusCode = 404; res.end() })
    return
  }
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>A4 fake-data check</title>
    <body><div id="account-a4-print-root"></div><script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { AccountPrintLayout } from '/src/features/user-insurer-accounts/print/AccountPrintLayout.tsx';
    import { getAccountPrintCss } from '/src/features/user-insurer-accounts/print/accountPrintStyles.ts';
    import { fitAccountPrintSheet } from '/src/features/user-insurer-accounts/print/fitAccountPrintSheet.ts';
    const params = new URLSearchParams(location.search);
    const orientation = params.get('orient') === 'portrait' ? 'portrait' : 'landscape';
    const count = Math.max(0, Math.min(1000, Number(params.get('rows') || 24)));
    const getCount = (key, fallback) => { const n = Number(params.get(key) ?? fallback); return Number.isFinite(n) ? Math.max(0, Math.min(1000, Math.floor(n))) : fallback; };
    const real = params.get('real') === '1';
    const lifeNames = ['교보생명', '미래에셋생명', '교보라이프플래닛', '한화생명', '삼성생명', '흥국생명'];
    const nonlifeNames = ['삼성화재', 'DB손해보험', '현대해상', '흥국화재', '메리츠화재', '한화손해보험'];
    const makeRows = (length, names) => Array.from({length}, (_, i) => ({company:real?names[i%names.length]:'가상 보험사 '+(i+1),loginId:real?('fake'+String(i).padStart(4,'0')).padEnd(8+i%5,'x'):'fake-id-'+i,password:params.has('long')?'FAKE-LONG-PASSWORD-'.repeat(12):real?('Fake!'+String(i).padStart(5,'0')).padEnd(10+i%5,'x'):'fake-password-'+i}));
    const style = document.createElement('style');
    style.textContent = getAccountPrintCss(orientation) + '#account-a4-print-root { visibility:visible; }';
    document.head.append(style);
    createRoot(document.getElementById('account-a4-print-root')).render(React.createElement(AccountPrintLayout,{orientation,life:makeRows(getCount('life',count),lifeNames),nonlife:makeRows(getCount('non',Math.max(0,count-3)),nonlifeNames)}));
    await document.fonts.ready;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fitAccountPrintSheet(document.getElementById('account-a4-print-root'), orientation);
    }));
    </script></body></html>`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(await server.transformIndexHtml('/__account-a4-check', html))
})
http.listen(3099, '127.0.0.1')
console.info('Fake-data print check: http://localhost:3099/__account-a4-check?life=19&non=12&real=1&orient=portrait')
