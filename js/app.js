/**
 * app.js — pengendali utama flipbook.
 *
 * Alur: pilih berkas (PDF / gambar / demo) -> render jadi image di browser
 * -> susun sebagai buku StPageFlip -> baca dengan efek balik halaman.
 */

import { Book, BLANK_MARK } from "./book.js";
import { pdfToPages, imagesToPages, revokePages, cancelRendering } from "./pdf-loader.js";
import { buildDemoPdf } from "./demo.js";
import { PaperSound } from "./paper.js";

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);

const el = {
  screenLanding: $("screenLanding"),
  screenReader: $("screenReader"),
  dropzone: $("dropzone"),
  fileInput: $("fileInput"),
  btnDemo: $("btnDemo"),
  btnLoadUrl: $("btnLoadUrl"),
  urlbar: $("urlbar"),
  srcInput: $("srcInput"),
  bookwrap: $("bookwrap"),
  flipbook: $("flipbook"),
  docTitle: $("docTitle"),
  btnClose: $("btnClose"),
  btnPrev: $("btnPrev"),
  btnNext: $("btnNext"),
  btnSpread: $("btnSpread"),
  btnSound: $("btnSound"),
  btnFull: $("btnFull"),
  pageSlider: $("pageSlider"),
  pageNow: $("pageNow"),
  pageAll: $("pageAll"),
  loader: $("loader"),
  loaderText: $("loaderText"),
  loaderBar: $("loaderBar"),
  loaderMeta: $("loaderMeta"),
  toast: $("toast"),
  hint: $("hint"),
};

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
const sound = new PaperSound();
const book = new Book(el.flipbook);

let currentUrls = [];
let currentTitle = "Demo";
let isDemo = false;
let busy = false;
let toastTimer = null;

const STORE_KEY = "flipbook:lastPage";

/* ------------------------------------------------------------------ */
/* Helper UI                                                           */
/* ------------------------------------------------------------------ */
function showScreen(which) {
  for (const s of [el.screenLanding, el.screenReader]) s.classList.remove("is-active");
  which.classList.add("is-active");
}

function loading(on, text = "", pct = null, meta = "") {
  el.loader.hidden = !on;
  if (on) {
    if (text) el.loaderText.textContent = text;
    el.loaderBar.style.width = pct == null ? "18%" : `${Math.round(pct * 100)}%`;
    el.loaderMeta.textContent = meta;
  }
}

function progress(done, total, label) {
  loading(true, "Membuka halaman\u2026", total ? done / total : 0, label || "");
}

function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle("is-error", isError);
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, isError ? 6000 : 3800);
}

function splitFiles(files) {
  const list = [...files];
  const pdfs = list.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  const imgs = list.filter((f) => /^image\//.test(f.type));
  return { pdfs, imgs };
}

function bytesLabel(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/* Buka dokumen                                                        */
/* ------------------------------------------------------------------ */
async function openDocument(source, title) {
  if (busy) return;
  busy = true;

  let pages = null;
  try {
    if (source.kind === "pdf") {
      loading(true, "Membaca PDF\u2026", 0.04, bytesLabel(source.bytes?.byteLength ?? source.bytes?.length));
      pages = await pdfToPages(source.bytes, { onProgress: progress });
      isDemo = false;
    } else if (source.kind === "images") {
      loading(true, "Menyiapkan gambar\u2026", 0.05, `${source.files.length} berkas`);
      pages = await imagesToPages(source.files, { onProgress: progress });
      isDemo = false;
    } else if (source.kind === "demo") {
      loading(true, "Menggambar komik demo\u2026", 0.08, "6 halaman");
      if (!window.PDFLib) throw new Error("pdf-lib belum siap, coba muat ulang halaman.");
      const { bytes, title: demoTitle } = await buildDemoPdf((d, t) => progress(d * 0.4, t, `Halaman ${d}`));
      loading(true, "Membaca PDF\u2026", 0.5, "");
      pages = await pdfToPages(bytes, { onProgress: (d, t) => progress(d * 0.6 + t * 0.4, t, `Halaman ${d} dari ${t}`) });
      title = title || demoTitle;
      isDemo = true;
    }

    if (!pages || !pages.urls.length) throw new Error("Tidak ada halaman yang bisa dirender.");

    currentTitle = title || "Tanpa judul";
    currentUrls = pages.urls;
    book.onChange = onBookChange;
    book.onMode = onBookMode;
    book.onState = onBookState;

    const startPage = isDemo ? Number(localStorage.getItem(STORE_KEY) || 0) : 0;

    book.open({
      urls: currentUrls,
      aspect: pages.aspect,
      startPage: Math.min(startPage, pages.urls.length - 1),
      forceSingle: el.btnSpread.getAttribute("aria-pressed") === "true",
    });

    el.docTitle.textContent = currentTitle;
    el.docTitle.title = currentTitle;
    document.title = `${currentTitle} — Flipbook`;

    showScreen(el.screenReader);
    restartHint();
    requestAnimationFrame(() => {
      book.scheduleFit();
      onBookChange(book.currentIndex, book.getMode());
    });
    sound.unlock();
  } catch (err) {
    console.error(err);
    const msg = friendlyError(err);
    toast(msg, true);
    showScreen(el.screenLanding);
  } finally {
    loading(false);
    busy = false;
  }
}

function friendlyError(err) {
  const m = String(err?.message || err || "");
  if (/password|encrypted/i.test(m)) return "PDF ini diproteksi kata sandi, jadi tidak bisa dibuka di browser.";
  if (/Invalid PDF|Badly formatted|unexpected/i.test(m)) return "File itu bukan PDF yang valid.";
  if (/Failed to fetch|NetworkError|CORS/i.test(m)) return "URL tidak bisa diambil. Pastikan server mengizinkan CORS, atau unduh dulu filenya lalu jatuhkan di sini.";
  if (/worker/i.test(m)) return "Mesin PDF gagal dimuat. Muat ulang halaman ini.";
  return `Gagal membuka dokumen: ${m.slice(0, 140)}`;
}

/* ------------------------------------------------------------------ */
/* Sinkronisasi UI buku                                                */
/* ------------------------------------------------------------------ */
function onBookChange(index, mode) {
  const total = book.getPageCount();
  el.pageNow.textContent = String(index + 1);
  el.pageAll.textContent = String(total);
  el.pageSlider.max = String(Math.max(0, total - 1));
  el.pageSlider.value = String(index);
  el.btnPrev.disabled = index <= 0;
  el.btnNext.disabled = index >= total - 1;

  if (isDemo) {
    try { localStorage.setItem(STORE_KEY, String(index)); } catch (_) { /* private mode */ }
  }
  if (mode) onBookMode(mode);
}

/**
 * Dipanggil tiap animasi mulai/selesai. Saat animasi berjalan tombol navigasi
 * dikunci supaya StPageFlip tidak dipaksa pindah di tengah balik halaman.
 */
function onBookState(state) {
  const busy = state !== "read";
  el.btnPrev.disabled = busy || book.currentIndex <= 0;
  el.btnNext.disabled = busy || book.currentIndex >= book.getPageCount() - 1;
  if (!busy) onBookChange(book.currentIndex, book.getMode());
}

function onBookMode(mode) {
  const single = mode === "portrait";
  el.btnSpread.classList.toggle("is-on", single);
  el.btnSpread.title = single ? "Aktifkan dua halaman berdampingan" : "Paksa satu halaman";
  book.scheduleFit();
}

function restartHint() {
  const node = el.hint;
  node.style.animation = "none";
  void node.offsetWidth;
  node.style.animation = "";
}

/* ------------------------------------------------------------------ */
/* Tutup dokumen                                                       */
/* ------------------------------------------------------------------ */
function closeDocument() {
  cancelRendering();
  book.destroy();
  revokePages(currentUrls.filter((u) => u !== BLANK_MARK));
  currentUrls = [];
  document.title = "Flipbook — Baca Komik dengan Efek Buka Halaman";
  showScreen(el.screenLanding);
  el.fileInput.value = "";
}

/* ------------------------------------------------------------------ */
/* Event: pemilih berkas                                               */
/* ------------------------------------------------------------------ */
el.dropzone.addEventListener("click", () => el.fileInput.click());
el.dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.fileInput.click(); }
});

el.fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

["dragenter", "dragover"].forEach((type) =>
  window.addEventListener(type, (e) => {
    e.preventDefault();
    el.dropzone.classList.add("is-over");
  })
);
["dragleave", "drop"].forEach((type) =>
  window.addEventListener(type, (e) => {
    e.preventDefault();
    if (type === "dragleave" && e.relatedTarget) return;
    el.dropzone.classList.remove("is-over");
  })
);
window.addEventListener("drop", (e) => {
  if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
});

async function handleFiles(fileList) {
  const { pdfs, imgs } = splitFiles(fileList || []);
  if (pdfs.length) {
    const file = pdfs[0];
    const bytes = new Uint8Array(await file.arrayBuffer());
    openDocument({ kind: "pdf", bytes }, file.name.replace(/\.pdf$/i, ""));
    if (pdfs.length > 1) toast(`Hanya PDF pertama yang dibuka (${pdfs.length - 1} lainnya dilewati).`);
  } else if (imgs.length) {
    openDocument({ kind: "images", files: imgs }, `${imgs.length} gambar`);
  } else if (fileList?.length) {
    toast("Format itu belum didukung. Gunakan PDF, JPG, PNG, atau WEBP.", true);
  }
}

/* ------------------------------------------------------------------ */
/* Event: demo & URL                                                   */
/* ------------------------------------------------------------------ */
el.btnDemo.addEventListener("click", () => openDocument({ kind: "demo" }, "The Last Barista (Demo)"));

function toggleUrlBar() {
  el.urlbar.hidden = !el.urlbar.hidden;
  if (!el.urlbar.hidden) el.srcInput.focus();
}

el.btnLoadUrl.addEventListener("click", toggleUrlBar);

async function loadFromUrl(raw) {
  const url = (raw || "").trim();
  if (!url) { toast("Masukkan URL PDF dulu.", true); return; }
  // Lepaskan fokus dari kolom URL supaya tombol panah langsung terpakai.
  el.srcInput.blur();
  try {
    loading(true, "Mengunduh PDF\u2026", 0.1, url.slice(0, 60));
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const name = decodeURIComponent(url.split("/").pop() || "dokumen").replace(/\.pdf$/i, "");
    openDocument({ kind: "pdf", bytes }, name);
  } catch (err) {
    loading(false);
    toast(friendlyError(err), true);
  }
}

el.srcInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadFromUrl(el.srcInput.value);
});

/* ------------------------------------------------------------------ */
/* Event: toolbar                                                      */
/* ------------------------------------------------------------------ */
el.btnClose.addEventListener("click", closeDocument);
el.btnNext.addEventListener("click", () => { if (book.next()) sound.play("next"); });
el.btnPrev.addEventListener("click", () => { if (book.prev()) sound.play("prev"); });

el.btnSpread.addEventListener("click", () => {
  const forced = book.toggleSpread();
  el.btnSpread.setAttribute("aria-pressed", String(forced));
  onBookChange(book.currentIndex, book.getMode());
  toast(forced ? "Mode satu halaman." : "Mode dua halaman (otomatis di layar lebar).");
});

el.btnSound.addEventListener("click", () => {
  const on = el.btnSound.getAttribute("aria-pressed") !== "true";
  el.btnSound.setAttribute("aria-pressed", String(on));
  el.btnSound.classList.toggle("is-on", on);
  sound.setEnabled(on);
  if (on) sound.play("next", 0.7);
});
el.btnSound.setAttribute("aria-pressed", "true");
el.btnSound.classList.add("is-on");

el.btnFull.addEventListener("click", toggleFullscreen);

function toggleFullscreen() {
  const doc = document;
  if (!doc.fullscreenElement) {
    (document.documentElement.requestFullscreen?.() || Promise.resolve()).catch?.(() => {});
  } else {
    doc.exitFullscreen?.().catch?.(() => {});
  }
}

document.addEventListener("fullscreenchange", () => {
  el.btnFull.classList.toggle("is-on", Boolean(document.fullscreenElement));
  book.scheduleFit();
});

el.pageSlider.addEventListener("input", () => {
  const i = Number(el.pageSlider.value);
  // Ditolak karena sedang beranimasi? Kembalikan slider ke posisi nyata.
  if (!book.goTo(i)) el.pageSlider.value = String(book.currentIndex);
});
// Setelah slider dilepas, kembalikan fokus ke body supaya tombol panah
// langsung dipakai lagi tanpa harus mengklik area buku.
el.pageSlider.addEventListener("change", () => el.pageSlider.blur());

/* ------------------------------------------------------------------ */
/* Event: papan ketik & resize                                         */
/* ------------------------------------------------------------------ */
/**
 * true hanya untuk field teks sungguhan. Slider & tombol TIDAK dihitung:
 * setelah pengguna menyentuh slider halaman, tombol panah harus tetap jalan.
 */
function isTyping(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === "TEXTAREA") return true;
  return target.tagName === "INPUT" && !/^(range|button|submit|checkbox|radio|file)$/i.test(target.type || "");
}

window.addEventListener("keydown", (e) => {
  const readerActive = el.screenReader.classList.contains("is-active");
  const typing = isTyping(document.activeElement);

  if (!readerActive) {
    if (!typing && e.key.toLowerCase() === "d") {
      e.preventDefault();
      openDocument({ kind: "demo" }, "The Last Barista (Demo)");
    }
    return;
  }
  // Esc selalu boleh, walau kursor masih di input.
  if (typing && e.key !== "Escape") return;

  switch (e.key) {
    case "ArrowRight":
    case "PageDown":
    case " ":
      e.preventDefault(); if (book.next()) sound.play("next"); break;
    case "ArrowLeft":
    case "PageUp":
      e.preventDefault(); if (book.prev()) sound.play("prev"); break;
    case "Home":
      e.preventDefault(); book.goTo(0); break;
    case "End":
      e.preventDefault(); book.goTo(book.getPageCount() - 1); break;
    case "Escape":
      closeDocument(); break;
    case "f":
    case "F":
      e.preventDefault(); toggleFullscreen(); break;
    case "s":
    case "S":
      e.preventDefault(); el.btnSpread.click(); break;
    default: break;
  }
});

let resizeRaf = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => book.scheduleFit());
});
window.addEventListener("orientationchange", () => setTimeout(() => book.scheduleFit(), 220));

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
(function boot() {
  const params = new URLSearchParams(location.search);
  const src = params.get("src");
  const demo = params.get("demo");

  if (src) {
    el.srcInput.value = src;
    loadFromUrl(src);
  } else if (demo === "1" || demo === "true") {
    // Beri waktu pdf-lib (script defer) untuk siap.
    const tryDemo = (attempt = 0) => {
      if (window.PDFLib) openDocument({ kind: "demo" }, "The Last Barista (Demo)");
      else if (attempt < 20) setTimeout(() => tryDemo(attempt + 1), 100);
      else toast("Komik demo gagal dimuat. Muat ulang halaman ini.", true);
    };
    tryDemo();
  }
})();
