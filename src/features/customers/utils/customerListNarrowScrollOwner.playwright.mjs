/**
 * Playwright: UI 복구(CSS absolute 없음) + 실제 scroll owner 추종.
 * usage: node src/features/customers/utils/customerListNarrowScrollOwner.playwright.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const indexCss = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8')

assert.doesNotMatch(
  indexCss,
  /\.pc-root\s+\.app-main-content[^{]*\.customer-workspace-layout\s*\{[^}]*position:\s*absolute/s,
)

const htmlDirect = `<!doctype html>
<html><head><meta charset="utf-8"/><style>
html,body{margin:0;height:100%}
${indexCss}
.app-workspace-layout-root{display:flex;flex-direction:column;height:100vh;min-height:0}
.workspace-root.workspace-root--app-pc{flex:1;min-height:0;display:flex;overflow:hidden}
.workspace-main.workspace-main--app{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.app-main-content{flex:1;min-height:0;overflow-y:auto}
.pad{height:2400px;background:#ddd}
</style></head>
<body class="pc-root app-workspace-layout-root">
<div class="workspace-root workspace-root--app-pc"><div class="workspace-main workspace-main--app">
<div class="app-main-content app-main-content--workspace-outlet-host">
  <div class="customer-workspace-layout">
    <aside class="customer-workspace-layout__left"><div class="pad"></div><button class="customer-list-scroll-top-button">↑</button></aside>
    <section class="customer-workspace-layout__right"></section>
  </div>
</div></div></div>
</body></html>`

const htmlWrappedNatural = `<!doctype html>
<html><head><meta charset="utf-8"/><style>
html,body{margin:0;height:100%}
.app-workspace-layout-root{display:flex;flex-direction:column;height:100vh;min-height:0}
.workspace-root.workspace-root--app-pc{flex:1;min-height:0;display:flex;overflow:hidden}
.workspace-main.workspace-main--app{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
/* natural narrow: app-main scrolls; left is content-height (not a scroll port) */
.app-main-content{flex:1;min-height:0;overflow-y:auto}
.customer-workspace-layout{display:flex;height:auto;max-height:none}
.customer-workspace-layout__left{overflow:visible;height:auto;width:100%;flex:none}
.pad{height:2400px;background:#ddd}
</style></head>
<body class="pc-root app-workspace-layout-root">
<div class="workspace-root workspace-root--app-pc"><div class="workspace-main workspace-main--app">
<div class="app-main-content app-main-content--workspace-outlet-host">
  <div class="outlet-wrap">
    <div class="customer-workspace-layout">
      <aside class="customer-workspace-layout__left" id="left">
        <main class="customers-page"><div class="pad"></div><button class="customer-list-scroll-top-button">↑</button></main>
      </aside>
      <section class="customer-workspace-layout__right"></section>
    </div>
  </div>
</div></div></div>
<script type="module">
  function isActuallyScrollable(el){
    if(!(el instanceof HTMLElement)) return false;
    const oy=getComputedStyle(el).overflowY;
    if(!(oy==='auto'||oy==='scroll'||oy==='overlay')) return false;
    return el.scrollHeight>el.clientHeight+1 || el.scrollTop>0;
  }
  function resolveOwner(anchor){
    const left=anchor.closest('.customer-workspace-layout__left');
    if(left && isActuallyScrollable(left)) return left;
    const app=anchor.closest('.app-main-content');
    if(app && isActuallyScrollable(app)) return app;
    let n=anchor;
    while(n){ if(isActuallyScrollable(n)) return n; n=n.parentElement; }
    return null;
  }
  function resolveTop(anchor){
    const container=resolveOwner(anchor);
    if(!container) return null;
    const left=anchor.closest('.customer-workspace-layout__left');
    if(left && container===left) return {container, top:0};
    const start=left || anchor.closest('.customers-page') || anchor;
    const top=Math.max(0, Math.round(container.scrollTop + (start.getBoundingClientRect().top - container.getBoundingClientRect().top)));
    return {container, top};
  }
  window.__fabTop = () => {
    const btn=document.querySelector('.customer-list-scroll-top-button');
    const owner=resolveOwner(btn);
    owner.scrollTop = Math.min(1800, owner.scrollHeight - owner.clientHeight);
    const before=owner.scrollTop;
    const target=resolveTop(btn);
    target.container.scrollTop = target.top;
    return {
      ownerClass: owner.className,
      before,
      after: target.container.scrollTop,
      targetTop: target.top,
      leftSt: document.getElementById('left').scrollTop,
    };
  };
</script>
</body></html>`

const browser = await chromium.launch({ headless: true })

// A) direct child wide — left should own
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.setContent(htmlDirect, { waitUntil: 'load' })
  const r = await page.evaluate(() => {
    const left = document.querySelector('.customer-workspace-layout__left')
    const app = document.querySelector('.app-main-content')
    left.scrollTop = 900
    return {
      leftSt: left.scrollTop,
      appSt: app.scrollTop,
      leftOy: getComputedStyle(left).overflowY,
      hasAbsolute: getComputedStyle(document.querySelector('.customer-workspace-layout')).position === 'absolute',
    }
  })
  assert.equal(r.hasAbsolute, false)
  assert.ok(r.leftSt > 0)
  assert.equal(r.appSt, 0)
  await page.close()
}

// B) natural wrapped narrow — app-main owns; FAB target brings list top
{
  const page = await browser.newPage({ viewport: { width: 700, height: 720 } })
  await page.setContent(htmlWrappedNatural, { waitUntil: 'load' })
  const r = await page.evaluate(() => window.__fabTop())
  assert.match(r.ownerClass, /app-main-content/)
  assert.ok(r.before > 0)
  assert.ok(r.after <= 2, JSON.stringify(r))
  await page.close()
}

await browser.close()
console.log('ui-restore-and-owner-follow PASS')
