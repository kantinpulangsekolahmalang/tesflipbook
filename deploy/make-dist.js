#!/usr/bin/env node
/**
 * deploy/make-dist.js
 *
 * Mengemas situs ini menjadi folder `deploy/dist` + arsip
 * `deploy/flipbook-dist.zip` yang siap diunggah ke hosting statis mana pun
 * (Netlify Drop, Cloudflare Pages, Vercel, cPanel/FTP, S3, dsb.).
 *
 * Situs ini tidak punya build step, jadi isi paket = berkas yang dijalankan.
 *
 *   node deploy/make-dist.js
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = join(here, "dist");
const zipPath = join(here, "flipbook-dist.zip");

/** Yang ikut dikemas; path relatif terhadap root repo. */
const INCLUDE = ["index.html", ".nojekyll", "css", "js", "assets"];

/** Berkas yang tidak boleh ikut walau berada di dalam folder di atas. */
const SKIP_DIRS = new Set(["node_modules", ".git", "__pycache__", "dist"]);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(join(dir, entry.name));
    } else if (entry.isFile()) {
      yield join(dir, entry.name);
    }
  }
}

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

rmSync(dist, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(dist, { recursive: true });

let files = 0;
let bytes = 0;

for (const entry of INCLUDE) {
  const src = join(root, entry);
  if (!existsSync(src)) {
    console.warn(`  lewati (tidak ditemukan): ${entry}`);
    continue;
  }
  const dest = join(dist, entry);
  if (statSync(src).isDirectory()) {
    cpSync(src, dest, { recursive: true });
    let n = 0;
    for (const f of walk(dest)) {
      // buang artefak pengembangan yang kebetulan terselip
      if (SKIP_DIRS.has(f)) continue;
      bytes += statSync(f).size;
      n++;
    }
    files += n;
    console.log(`  + ${entry}/  (${n} berkas)`);
  } else {
    cpSync(src, dest);
    bytes += statSync(dest).size;
    files++;
    console.log(`  + ${entry}`);
  }
}

writeFileSync(
  join(dist, "DEPLOY.txt"),
  [
    "FLIPBOOK - paket siap unggah",
    "============================",
    "",
    "Situs statis murni: tidak ada build step, tidak ada dependensi runtime.",
    "Semua library sudah disertakan di dalam folder assets/vendor/, jadi",
    "situs ini jalan tanpa internet dan tanpa CDN.",
    "",
    "CARA PAKAI: unggah SELURUH isi folder ini ke root situs web kamu.",
    "",
    "  Netlify Drop      https://app.netlify.com/drop - jatuhkan folder ini",
    "  Cloudflare Pages  Direct Upload - pilih folder ini",
    "  Vercel            jalankan: vercel deploy --prod  (dari dalam folder ini)",
    "  cPanel / FTP      unggah ke public_html/",
    "  GitHub Pages      taruh di branch gh-pages, atau pakai Actions",
    "",
    "Syarat hosting: cukup bisa menyajikan berkas statis. Tidak perlu Node,",
    "PHP, atau basis data. Pastikan ekstensi .mjs dilayani dengan MIME",
    "JavaScript (text/javascript) - hampir semua hosting sudah benar secara",
    "bawaan; kalau tidak, worker pdf.js akan gagal dimuat.",
    "",
    "Setelah online, buka situsnya lalu jatuhkan file PDF atau gambar.",
    "Bisa juga memuat PDF lewat URL:",
    "  https://situs-kamu/?src=https://contoh.com/komik.pdf",
    "",
    `Jumlah berkas : ${files}`,
    `Ukuran        : ${mb(bytes)}`,
    `Dikemas pada  : ${new Date().toISOString()}`,
    "",
  ].join("\n")
);

execFileSync("zip", ["-qr9", zipPath, "."], { cwd: dist });

console.log("");
console.log(`  folder : ${relative(root, dist)}/   (${files} berkas, ${mb(bytes)})`);
console.log(`  arsip  : ${relative(root, zipPath)}   (${mb(statSync(zipPath).size)})`);
console.log("");
console.log("  Arsip zip itulah yang kamu unggah / jatuhkan ke hosting.");
