# tesflipbook

Web flipbook statis: buka PDF atau kumpulan gambar langsung di browser, lalu
baca dengan **transisi membalik halaman seperti buku sungguhan** — sudut
halaman bisa ditarik, ada bayangan, lengkungan kertas, dan sampul yang kaku.

Tidak ada build step, tidak ada backend, tidak ada CDN: semua library ikut
dikirim di dalam repo, jadi situsnya jalan di hosting statis mana pun.

---

## Fitur

- **Transisi halaman 3D** — tarik sudut halaman dengan mouse/jari, klik sisi
  buku, geser (swipe), pakai tombol panah di toolbar, slider, atau keyboard.
- **Mode buku terbuka (spread)** — dua halaman berdampingan di layar lebar,
  otomatis jadi satu halaman di layar sempit, plus tombol untuk memaksa satu
  halaman di layar besar.
- **Sampul keras** — halaman pertama & terakhir berperilaku seperti sampul buku
  (kaku, tidak melengkung), halaman dalam melengkung seperti kertas. Bila jumlah
  halaman genap, otomatis disisipkan satu halaman pengisi agar susunan
  `[sampul] [isi berpasangan] [sampul belakang]` tetap benar.
- **Suara kertas** — disintesis lewat Web Audio API, tanpa berkas audio.
- **Baca PDF apa pun** — jatuhkan berkas PDF, atau folder gambar (JPG/PNG/WEBP).
  Semua dirender di browser; tidak ada berkas yang diunggah ke server mana pun.
- **Muat dari URL** — `?src=https://contoh.com/komik.pdf`.
- **Komik demo** — digambar otomatis saat runtime memakai pdf-lib, jadi situs
  tidak pernah terasa kosong dan bisa langsung dicoba.
- **Tahan macet** — ada watchdog yang memulihkan buku bila animasi balik
  halaman tidak pernah selesai (misalnya tab sempat dipindah ke background).

## Isi repo

```
index.html                  aplikasi
css/style.css               tema + layout
js/app.js                   pengendali utama (pemilih berkas, toolbar, keyboard)
js/book.js                  pembungkus StPageFlip (spread, sampul, ukuran, watchdog)
js/pdf-loader.js            pdf.js: PDF -> gambar tiap halaman (+ folder gambar)
js/demo.js                  pdf-lib: menggambar komik demo 6 halaman
js/paper.js                 efek suara kertas (Web Audio)
assets/vendor/              library di-vendor lokal, tanpa CDN
deploy/make-dist.js         pengemas paket siap unggah
.github/workflows/pages.yml deploy otomatis ke GitHub Pages (opsional)
package.json                hanya berisi npm script, tanpa dependensi
```

| Library | Versi | Lisensi |
| --- | --- | --- |
| [StPageFlip](https://github.com/Nodlik/StPageFlip) (`page-flip`) | 2.0.7 | MIT |
| [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`, build legacy) | 4.8.69 | Apache-2.0 |
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | MIT |

## Menjalankan lokal

Tidak perlu `npm install` (tidak ada dependensi). Cukup serve foldernya —
ES module butuh HTTP, tidak bisa dibuka lewat `file://`:

```bash
npm run serve          # sama dengan: python3 -m http.server 8080 --bind 0.0.0.0
# buka http://localhost:8080
```

## Deploy mandiri (cara paling gampang)

Situs ini statis murni, jadi tinggal unggah.

**1. Buat paketnya**

```bash
npm run dist
# -> deploy/dist/            (folder siap unggah, ~2,3 MB)
# -> deploy/flipbook-dist.zip (~0,7 MB)
```

**2. Unggah ke hosting mana pun**

| Hosting | Caranya |
| --- | --- |
| **Netlify Drop** | buka <https://app.netlify.com/drop>, jatuhkan folder `deploy/dist` |
| **Cloudflare Pages** | *Direct Upload* → pilih folder `deploy/dist` |
| **Vercel** | `cd deploy/dist && vercel deploy --prod` |
| **cPanel / FTP** | unggah isi `deploy/dist` ke `public_html/` |
| **S3 / object storage** | unggah isi `deploy/dist`, aktifkan static website hosting |
| **GitHub Pages** | lihat bagian di bawah |

Syarat hostingnya cuma satu: bisa menyajikan berkas statis. Tidak perlu Node,
PHP, atau basis data.

> **Penting:** pastikan hosting melayani ekstensi `.mjs` dengan MIME
> `text/javascript`. Kalau tidak, worker pdf.js gagal dimuat dan PDF tidak bisa
> dibuka (halaman demo tetap jalan karena tidak memakai pdf.js).
> Netlify, Cloudflare, Vercel, dan GitHub Pages sudah benar secara bawaan.
> Untuk Apache/cPanel, tambahkan bila perlu:
>
> ```apache
> AddType text/javascript .mjs
> ```

Karena seluruh path di dalam situs ini relatif, menaruhnya di subfolder
(mis. `public_html/flipbook/`) juga langsung jalan.

## Deploy ke GitHub Pages (opsional)

Workflow `.github/workflows/pages.yml` sudah terpasang dan men-deploy otomatis
setiap push ke `main`. Yang kurang hanya satu langkah manual — **menyalakan
Pages butuh izin admin repo**, sedangkan token otomasi (dan `GITHUB_TOKEN`
milik workflow) ditolak GitHub dengan `403 Resource not accessible by integration`:

1. Buka <https://github.com/kantinpulangsekolahmalang/tesflipbook/settings/pages>
2. **Build and deployment → Source** → pilih **GitHub Actions**
3. Jalankan ulang workflow-nya (tab **Actions** → *Deploy ke GitHub Pages* →
   **Re-run jobs**), atau push sekali lagi
4. Situs muncul di <https://kantinpulangsekolahmalang.github.io/tesflipbook/>

Alternatif tanpa Actions: buat branch `gh-pages`, taruh isi `deploy/dist` di
sana, lalu di Settings → Pages pilih *Deploy from a branch* → `gh-pages` / `/ (root)`.

## Menaruh komik sendiri di situs

Karena PDF dibaca di sisi klien, ada tiga cara:

1. **Paling gampang** — buka situsnya, jatuhkan PDF-nya. Tidak perlu deploy ulang.
2. **Biar bisa dibagikan lewat link** — taruh PDF di situs (mis. `assets/komik.pdf`)
   lalu bagikan `…/?src=assets/komik.pdf`.
3. **Versi gambar** — taruh `001.jpg`, `002.jpg`, … dalam satu folder, lalu
   jatuhkan seluruh folder itu ke halaman depan. Urutannya mengikuti nama berkas.

> Catatan: PDF besar ikut terhitung ke kuota hosting/repo. Untuk komik puluhan
> MB, cara (1) paling sehat.

## Pintasan keyboard

| Tombol | Aksi |
| --- | --- |
| `→` / `Space` / `PageDown` | halaman berikutnya |
| `←` / `PageUp` | halaman sebelumnya |
| `Home` / `End` | halaman pertama / terakhir |
| `F` | layar penuh |
| `S` | ganti mode satu ↔ dua halaman |
| `Esc` | tutup dokumen |
| `D` | buka komik demo (di halaman depan) |

Pintasan tetap aktif setelah kamu memakai slider halaman — fokus slider
dilepas otomatis supaya tombol panah langsung terpakai lagi.
