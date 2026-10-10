# tesflipbook

Web flipbook statis: buka PDF atau kumpulan gambar langsung di browser, lalu
baca dengan **transisi membalik halaman seperti buku sungguhan** — sudut
halaman bisa ditarik, ada bayangan, lengkungan kertas, dan sampul keras.

Situs live (setelah GitHub Pages dinyalakan):
<https://kantinpulangsekolahmalang.github.io/tesflipbook/>

---

## Fitur

- **Transisi halaman 3D** — tarik sudut halaman dengan mouse/jari, klik sisi
  buku, geser (swipe), pakai tombol panah di toolbar, atau keyboard.
- **Mode buku terbuka (spread)** — dua halaman berdampingan di layar lebar,
  otomatis jadi satu halaman di layar sempit. Bisa dipaksa satu halaman lewat
  tombol spread.
- **Sampul keras** — halaman pertama & terakhir berperilaku seperti sampul buku
  (kaku, tidak melengkung), halaman dalam melengkung seperti kertas.
- **Suara kertas** — disintesis lewat Web Audio API, tanpa berkas audio.
- **Baca PDF apa pun** — jatuhkan berkas PDF atau folder gambar (JPG/PNG/WEBP).
  Semua dirender di browser, tidak ada yang diunggah ke server mana pun.
- **Muat dari URL** — `?src=https://contoh.com/komik.pdf`.
- **Komik demo** — digambar otomatis saat runtime memakai pdf-lib, jadi situs
  tidak pernah terasa kosong.

## Isi repo

```
index.html                  aplikasi
css/style.css               tema + layout
js/app.js                   pengendali utama (file picker, toolbar, keyboard)
js/book.js                  pembungkus StPageFlip (spread, sampul keras, resize)
js/pdf-loader.js            pdf.js: PDF -> gambar tiap halaman (+ image folder)
js/demo.js                  pdf-lib: membuat komik demo 6 halaman
js/paper.js                 efek suara kertas (Web Audio)
assets/vendor/              library di-vendor lokal, tanpa CDN
.github/workflows/pages.yml deploy otomatis ke GitHub Pages
```

Semua dependensi di-vendor ke `assets/vendor/`, jadi situs ini **tidak butuh
build step dan tidak butuh internet** saat dibuka.

| Library | Versi | Lisensi |
| --- | --- | --- |
| [StPageFlip](https://github.com/Nodlik/StPageFlip) (`page-flip`) | 2.0.7 | MIT |
| [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`, build legacy) | 4.8.69 | Apache-2.0 |
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | MIT |

## Menjalankan lokal

Tidak ada `npm install`. Cukup serve foldernya (ES module butuh HTTP, bukan `file://`):

```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

## Publikasi ke GitHub Pages

Deploy memakai **GitHub Actions** (workflow `.github/workflows/pages.yml`),
jadi tidak perlu merge ke branch `gh-pages`.

Satu-satunya langkah manual — **token otomasi tidak punya izin menyalakan
Pages**, jadi pemilik repo perlu melakukannya sekali:

1. Buka <https://github.com/kantinpulangsekolahmalang/tesflipbook/settings/pages>
2. **Build and deployment → Source** → pilih **GitHub Actions**
3. Selesai. Push berikutnya ke `main` otomatis men-deploy, dan situs muncul di
   <https://kantinpulangsekolahmalang.github.io/tesflipbook/>

Cek progres deploy di tab **Actions** → workflow *Deploy ke GitHub Pages*.

## Menaruh komik sendiri di situs

Karena PDF dibaca di sisi klien, ada tiga cara:

1. **Paling gampang** — buka situsnya, jatuhkan PDF-nya. Tidak perlu deploy ulang.
2. **Biar bisa dibagikan lewat link** — taruh PDF di repo (mis. `assets/komik.pdf`)
   lalu bagikan `…/tesflipbook/?src=assets/komik.pdf`.
3. **Versi gambar** — taruh `assets/pages/001.jpg`, `002.jpg`, … lalu jatuhkan
   seluruh foldernya ke halaman depan.

> Catatan: PDF besar ikut terhitung ke ukuran repo GitHub. Untuk komik puluhan
> MB, cara (1) atau hosting berkas di luar repo lebih sehat.

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
