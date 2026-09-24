// Servisni radnik: aplikacija se otvara odmah (i bez mreže), a pretraga uvijek ide na server.
// Povećaj VERZIJA kad se promijeni index.html da se stari keš odbaci.
const VERZIJA = "v6";
const KES = "autodijelovi-" + VERZIJA;
const LJUSKA = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(KES).then((k) => k.addAll(LJUSKA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((imena) => Promise.all(imena.filter((i) => i.startsWith("autodijelovi-") && i !== KES).map((i) => caches.delete(i))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  const url = new URL(r.url);
  // Samo naš izvor i samo GET; API pretrage i slike dijelova (drugi izvor) nikad ne diramo.
  if (r.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.endsWith("katalog.json")) return;

  // Stranica: prvo mreža (da uvijek vidiš najnoviju verziju), keš samo kad nema veze.
  if (r.mode === "navigate") {
    e.respondWith(
      fetch(r)
        .then((odg) => {
          // Pamti se samo početna stranica ("/"); stranice pojedinih dijelova (/dio/...) se ne stavljaju u keš.
          if (odg.ok && url.pathname === "/") {
            const kopija = odg.clone();
            caches.open(KES).then((k) => k.put("/", kopija));
          }
          return odg;
        })
        .catch(() => (url.pathname === "/"
          ? caches.match("/")
          : new Response('<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;text-align:center;padding:40px"><h2>Nema veze</h2><p>Provjeri internet pa pokušaj ponovo.</p><p><a href="/">Otvori katalog</a></p>', { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })))
    );
    return;
  }

  // Ostalo (ikone, spisak vozila): iz keša odmah, a u pozadini osvježi.
  e.respondWith(
    caches.match(r).then((kesirano) => {
      const mreza = fetch(r)
        .then((odg) => {
          if (odg.ok) {
            const kopija = odg.clone();
            caches.open(KES).then((k) => k.put(r, kopija));
          }
          return odg;
        })
        .catch(() => kesirano);
      return kesirano || mreza;
    })
  );
});
