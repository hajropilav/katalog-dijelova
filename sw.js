// Servisni radnik: aplikacija se otvara odmah (i bez mreže), a pretraga uvijek ide na server.
// Povećaj VERZIJA kad se promijeni index.html da se stari keš odbaci.
const VERZIJA = "v1";
const KES = "autodijelovi-" + VERZIJA;
const LJUSKA = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

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
          const kopija = odg.clone();
          caches.open(KES).then((k) => k.put("index.html", kopija));
          return odg;
        })
        .catch(() => caches.match("index.html").then((c) => c || caches.match("./")))
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
