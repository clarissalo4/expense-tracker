/* 記帳本 Service Worker — 離線快取
   呢個檔放喺 assets/ 入面；註冊嗰陣頁面會嘗試將 scope 擴到成個網站。
   快取只存網站本身嘅檔案（HTML／圖示／字型），唔會存用家嘅記帳資料
   （記帳資料本身已經喺 localStorage，離線都用到）。 */
var CACHE = "jizhang-pwa-v1";
var CORE = [
  "../index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(CORE).catch(function () { /* 個別檔失敗唔好擋住安裝 */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  /* Gemini API 等外部請求唔好經快取，直接去網絡 */
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    /* 頁面：網絡優先，冇網絡就用快取版，保證離線開到 */
    e.respondWith(
      fetch(req).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (cache) { cache.put("../index.html", copy); });
        return resp;
      }).catch(function () {
        return caches.match("../index.html", { ignoreSearch: true })
          .then(function (hit) { return hit || caches.match(req, { ignoreSearch: true }); });
      })
    );
    return;
  }

  /* 其他同源檔案（圖示等）：快取優先，背後更新 */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return resp;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
