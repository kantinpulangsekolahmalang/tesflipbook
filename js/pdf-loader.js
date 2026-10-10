/**
 * pdf-loader.js
 * Membaca PDF (atau berkas gambar) di dalam browser memakai pdf.js yang
 * sudah di-vendor lokal, lalu merender tiap halaman menjadi blob URL gambar
 * agar bisa dipakai sebagai halaman flipbook.
 *
 * Tidak ada berkas yang dikirim ke server mana pun.
 */

/**
 * Lokasi worker pdf.js. `import.meta.url` kosong bila berkas ini dibundel ke
 * format non-ESM, jadi ada fallback path relatif (tetap benar karena seluruh
 * situs memakai URL relatif).
 */
const WORKER_SRC = import.meta.url
  ? new URL("../assets/vendor/pdf.worker.min.mjs", import.meta.url).href
  : "assets/vendor/pdf.worker.min.mjs";

/** Batas lebar render (px) agar tetap ringan di HP maupun PDF tebal. */
function renderWidthFor(pageCount) {
  if (pageCount > 200) return 800;
  if (pageCount > 80) return 1000;
  return 1280;
}

let pdfjsPromise = null;

/** pdf.js dimuat dinamis supaya halaman landing tetap ringan. */
export function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("../assets/vendor/pdf.min.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

let activeTask = null;

/** Hentikan render yang sedang berjalan (dipakai saat user menutup buku). */
export function cancelRendering() {
  if (activeTask) {
    try { activeTask.cancel(); } catch (_) { /* sudah selesai */ }
    activeTask = null;
  }
}

/**
 * Render sebuah PDF jadi daftar URL gambar.
 *
 * @param {ArrayBuffer|Uint8Array} data  isi berkas PDF
 * @param {object}   opts
 * @param {Function} opts.onProgress     (done, total, label) => void
 * @param {number}   [opts.maxWidth]     paksa lebar render tertentu
 * @param {number}   [opts.quality]      kualitas JPEG 0..1
 * @returns {Promise<{urls:string[], width:number, height:number, aspect:number, count:number}>}
 */
export async function pdfToPages(data, opts = {}) {
  const pdfjs = await getPdfJs();
  const { onProgress = () => {}, quality = 0.85 } = opts;

  // pdf.js mengambil alih (transfer) buffer-nya, jadi kita kasih salinan.
  const copy = data instanceof ArrayBuffer ? data.slice(0) : data.slice();
  const doc = await pdfjs.getDocument({
    data: copy,
    isEvalSupported: false,
    disableFontFace: false,
  }).promise;

  const count = doc.numPages;
  const targetW = opts.maxWidth || renderWidthFor(count);

  // Ambil ukuran halaman pertama sebagai acuan rasio buku.
  const first = await doc.getPage(1);
  const vb = first.getViewport({ scale: 1 });
  const aspect = vb.width / vb.height;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const urls = [];

  for (let n = 1; n <= count; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, Math.max(0.4, targetW / base.width));
    const viewport = page.getViewport({ scale });

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    activeTask = page.render({ canvasContext: ctx, viewport });
    await activeTask.promise;
    activeTask = null;

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    urls.push(URL.createObjectURL(blob));

    onProgress(n, count, `Halaman ${n} dari ${count}`);
    page.cleanup();

    // Beri kesempatan browser bernapas agar UI tidak beku di PDF tebal.
    if (n % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  try { doc.destroy(); } catch (_) { /* abaikan */ }

  return {
    urls,
    width: Math.round(vb.width),
    height: Math.round(vb.height),
    aspect,
    count,
  };
}

/**
 * Berkas gambar biasa (JPG/PNG/WEBP) -> halaman flipbook.
 * Urutan mengikuti nama berkas agar folder komik tersusun rapi.
 *
 * @param {File[]} files
 * @param {object} opts
 * @returns {Promise<{urls:string[], aspect:number, count:number}>}
 */
export async function imagesToPages(files, opts = {}) {
  const { onProgress = () => {} } = opts;

  const sorted = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, "id", { numeric: true, sensitivity: "base" })
  );

  const urls = [];
  let aspect = 0.7071; // default A4-ish portrait

  for (let i = 0; i < sorted.length; i++) {
    const url = URL.createObjectURL(sorted[i]);
    const size = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = url;
    });
    if (!size.w || !size.h) {
      URL.revokeObjectURL(url);
      continue;
    }
    if (i === 0) aspect = size.w / size.h;
    urls.push(url);
    onProgress(i + 1, sorted.length, `Gambar ${i + 1} dari ${sorted.length}`);
  }

  return { urls, aspect, count: urls.length };
}

/** Buang semua blob URL agar memori bersih saat buku ditutup. */
export function revokePages(urls = []) {
  urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) { /* noop */ } });
}
