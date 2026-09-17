/**
 * Yandex Metrika tag (counter 112556703), full tag + Webvisor.
 *
 * Loaded site-wide at the owner's explicit request. It pulls tag.js from
 * mc.yandex.ru and records Webvisor sessions, so the CSP in
 * deploy/security-headers.conf is relaxed to allow mc.yandex.ru / yastatic.net /
 * mc.webvisor.* and blob:. This is third-party JavaScript on pages that also
 * handle live Claude session cookies — a deliberate trade the owner chose.
 *
 * The inline init relies on `script-src 'unsafe-inline'`, which the site already
 * ships. Rendered in <head> for early load; the no-JS pixel lives in <body>.
 */
const COUNTER_ID = 112556703

export function YandexMetrika() {
  const script = `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${COUNTER_ID}, "init", {clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}

/** No-JS fallback pixel; must sit in <body>, not <head>. */
export function YandexMetrikaNoScript() {
  return (
    <noscript>
      <div>
        <img
          src={`https://mc.yandex.ru/watch/${COUNTER_ID}`}
          style={{ position: 'absolute', left: '-9999px' }}
          alt=""
        />
      </div>
    </noscript>
  )
}
