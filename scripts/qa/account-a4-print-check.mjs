/** Dev-only: node scripts/qa/account-a4-print-check.mjs
 * Open http://localhost:3099/__account-a4-check?rows=33&long=1
 * Uses ONLY fake data and the production print component/CSS. Browser print
 * preview (Ctrl+P) verifies landscape, one page, full wrapping and no app shell.
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
    import { AccountPrintLayout, ACCOUNT_PRINT_CSS } from '/src/features/user-insurer-accounts/print/AccountPrintLayout.tsx';
    import { fitAccountPrintSheet } from '/src/features/user-insurer-accounts/print/fitAccountPrintSheet.ts';
    const params = new URLSearchParams(location.search);
    const count = Math.max(0, Math.min(1000, Number(params.get('rows') || 24)));
    const rows = Array.from({length:count}, (_, i) => ({company:'가상 보험사 '+(i+1),loginId:'fake-id-'+i,password:params.has('long')?'FAKE-LONG-PASSWORD-'.repeat(12):'fake-password-'+i}));
    const style = document.createElement('style');
    style.textContent = ACCOUNT_PRINT_CSS + '#account-a4-print-root { visibility:visible; }';
    document.head.append(style);
    createRoot(document.getElementById('account-a4-print-root')).render(React.createElement(AccountPrintLayout,{life:rows,nonlife:rows.slice(0,Math.max(0,count-3))}));
    await document.fonts.ready;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fitAccountPrintSheet(document.getElementById('account-a4-print-root'));
    }));
    </script></body></html>`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(await server.transformIndexHtml('/__account-a4-check', html))
})
http.listen(3099, '127.0.0.1')
console.info('Fake-data print check: http://localhost:3099/__account-a4-check?rows=33&long=1')
