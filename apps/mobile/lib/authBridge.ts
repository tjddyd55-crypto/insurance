/** WebView ↔ native auth bridge (CRM session in localStorage). */

export const AUTH_STORAGE_KEY = 'insurance.auth.session'

export type BridgedAuthSession = {
  token: string
  userId?: string
}

/**
 * Injected before/after page load. Posts AUTH_SESSION / AUTH_LOGOUT to RN.
 * Does not include the token in console logs.
 */
export const AUTH_BRIDGE_INJECTED_JS = `
(function(){
  try {
    var KEY=${JSON.stringify(AUTH_STORAGE_KEY)};
    var lastToken='';
    function read(){
      try {
        var raw=localStorage.getItem(KEY);
        if(!raw){ return null; }
        var parsed=JSON.parse(raw);
        var token=parsed&&typeof parsed.token==='string'?parsed.token.trim():'';
        if(!token){ return null; }
        var userId=parsed&&parsed.user&&parsed.user.id!=null?String(parsed.user.id):'';
        return { token: token, userId: userId };
      } catch(e){ return null; }
    }
    function emit(){
      try {
        var s=read();
        var token=s&&s.token?s.token:'';
        if(token===lastToken){ return; }
        lastToken=token;
        if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){
          if(token){
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'AUTH_SESSION',token:token,userId:s.userId||''}));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'AUTH_LOGOUT'}));
          }
        }
      } catch(e){}
    }
    emit();
    setInterval(emit, 2500);
    window.addEventListener('storage', function(ev){
      if(ev&&ev.key===KEY){ emit(); }
    });
  } catch(e){}
  true;
})();
`

export function parseAuthBridgeMessage(raw: string): { type: 'AUTH_SESSION'; token: string; userId: string } | { type: 'AUTH_LOGOUT' } | null {
  try {
    const data = JSON.parse(raw) as { type?: string; token?: string; userId?: string }
    if (data?.type === 'AUTH_LOGOUT') {
      return { type: 'AUTH_LOGOUT' }
    }
    if (data?.type === 'AUTH_SESSION') {
      const token = String(data.token ?? '').trim()
      if (!token) return null
      return { type: 'AUTH_SESSION', token, userId: String(data.userId ?? '').trim() }
    }
  } catch {
    return null
  }
  return null
}

/** Only allow internal CRM paths for post-login restore. */
export function isSafeInternalReturnPath(path: string): boolean {
  const p = String(path ?? '').trim()
  if (!p.startsWith('/')) return false
  if (p.startsWith('//')) return false
  if (p.includes('://')) return false
  if (p.toLowerCase().includes('/customer-app')) return false
  if (p.toLowerCase().includes('/customer/register')) return false
  return (
    p.startsWith('/customers/') ||
    p.startsWith('/customers?') ||
    p === '/customers'
  )
}
