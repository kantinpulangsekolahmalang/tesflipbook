/**
 * demo.js
 * Membuat komik pendek 6 halaman secara runtime memakai pdf-lib (vendored).
 * Hasilnya berupa Uint8Array PDF yang lalu diproses lewat jalur yang sama
 * dengan PDF milik pengguna — jadi demo ini sekaligus menguji pipeline.
 *
 * Catatan: font bawaan PDF (Helvetica) hanya mendukung WinAnsi/ASCII,
 * jadi seluruh teks di sini sengaja bebas karakter khusus.
 */

const W = 540;
const H = 760;

/**
 * pdf-lib menolak objek warna polos; semua warna wajib lewat rgb().
 * Didefinisikan sebagai function (bukan const) supaya konstanta warna di
 * bawah ini bisa diinisialisasi tanpa masalah urutan / temporal dead zone.
 */
function rgb(...a) {
  return window.PDFLib.rgb(...a);
}

const CREAM = rgb(0.953, 0.906, 0.827);
const CREAM_D = rgb(0.906, 0.847, 0.749);
const INK = rgb(0.141, 0.094, 0.067);
const INK_SOFT = rgb(0.416, 0.333, 0.267);
const TERRA = rgb(0.769, 0.392, 0.227);
const GOLD = rgb(0.878, 0.639, 0.243);
const WHITE = rgb(1, 1, 1);

function drawText(page, font, text, size, cx, y, color = INK, maxWidth = W - 120) {
  let s = size;
  let w = font.widthOfTextAtSize(text, s);
  while (w > maxWidth && s > 5) {
    s -= 0.5;
    w = font.widthOfTextAtSize(text, s);
  }
  page.drawText(text, { x: cx - w / 2, y, size: s, font, color });
  return s;
}

function frame(page, pad = 26, color = INK, thickness = 1.6, opacity = 1) {
  page.drawRectangle({
    x: pad, y: pad, width: W - pad * 2, height: H - pad * 2,
    borderColor: color, borderWidth: thickness, borderOpacity: opacity,
  });
}

function rule(page, x1, x2, y, color = INK_SOFT, thickness = 1, opacity = 0.55) {
  page.drawLine({
    start: { x: x1, y }, end: { x: x2, y },
    thickness, color, opacity,
  });
}

/** Secangkir kopi sederhana: badan, kaki, telinga + tiga garis uap. */
function cup(page, cx, cy, s, opts = {}) {
  const body = opts.body || WHITE;
  const outline = opts.outline || INK;

  page.drawSvgPath(
    `M ${-s} 0 L ${s} 0 L ${s * 0.66} ${-s * 1.02} L ${-s * 0.66} ${-s * 1.02} Z`,
    { x: cx, y: cy, borderColor: outline, borderWidth: s * 0.085, color: body }
  );
  page.drawEllipse({
    x: cx, y: cy - s * 1.02, xScale: s * 0.32, yScale: s * 0.1,
    color: outline, opacity: 0.9,
  });
  page.drawSvgPath(
    `M ${s * 0.96} ${-s * 0.2} C ${s * 1.62} ${-s * 0.18} ${s * 1.6} ${-s * 0.74} ${s * 0.78} ${-s * 0.72}`,
    { x: cx, y: cy, borderColor: outline, borderWidth: s * 0.085 }
  );
  page.drawEllipse({
    x: cx, y: cy + s * 0.02, xScale: s * 0.98, yScale: s * 0.2,
    color: opts.liquid || TERRA, borderColor: outline, borderWidth: s * 0.07,
  });

  if (opts.steam !== false) {
    const sw = s * 0.075;
    page.drawSvgPath(
      `M ${-s * 0.34} ${s * 0.42} C ${-s * 0.02} ${s * 0.72} ${-s * 0.62} ${s * 1.0} ${-s * 0.3} ${s * 1.34}`,
      { x: cx, y: cy, borderColor: outline, borderWidth: sw, opacity: 0.5 }
    );
    page.drawSvgPath(
      `M ${s * 0.06} ${s * 0.46} C ${s * 0.4} ${s * 0.8} ${-s * 0.2} ${s * 1.08} ${s * 0.12} ${s * 1.46}`,
      { x: cx, y: cy, borderColor: outline, borderWidth: sw, opacity: 0.62 }
    );
    page.drawSvgPath(
      `M ${s * 0.46} ${s * 0.4} C ${s * 0.78} ${s * 0.68} ${s * 0.2} ${s * 0.94} ${s * 0.52} ${s * 1.26}`,
      { x: cx, y: cy, borderColor: outline, borderWidth: sw, opacity: 0.42 }
    );
  }
}

/** Siluet barista: kepala, badan celemek, lengan menuang. */
function barista(page, cx, baseY, s, color = INK) {
  page.drawCircle({ x: cx, y: baseY + s * 1.62, size: s * 0.34, color });
  page.drawSvgPath(
    `M ${-s * 0.52} 0 L ${s * 0.52} 0 L ${s * 0.4} ${s * 1.32} L ${-s * 0.4} ${s * 1.32} Z`,
    { x: cx, y: baseY, color }
  );
  page.drawSvgPath(
    `M ${-s * 0.4} ${s * 1.28} C ${-s * 0.9} ${s * 1.1} ${-s * 1.0} ${s * 0.6} ${-s * 0.74} ${s * 0.44}`,
    { x: cx, y: baseY, borderColor: color, borderWidth: s * 0.16 }
  );
}

function pageBase(doc, bg = CREAM) {
  const p = doc.addPage([W, H]);
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });
  return p;
}

function pageNumber(page, font, n, total) {
  drawText(page, font, `${n} / ${total}`, 11, W / 2, 44, INK_SOFT, 200);
}

/**
 * Bangun PDF demo.
 * @param {(done:number,total:number)=>void} [onStep]
 * @returns {Promise<{bytes:Uint8Array, title:string}>}
 */
export async function buildDemoPdf(onStep = () => {}) {
  const { PDFDocument, StandardFonts } = window.PDFLib;
  const doc = await PDFDocument.create();
  doc.setTitle("The Last Barista (Demo Flipbook)");
  doc.setAuthor("Flipbook Demo");

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const TOTAL = 6;

  // ---- 1. Sampul -------------------------------------------------------
  {
    const p = pageBase(doc);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: INK });
    p.drawRectangle({
      x: 0, y: H - 250, width: W, height: 250, color: rgb(0.18, 0.125, 0.094),
    });
    frame(p, 30, GOLD, 2, 0.85);
    frame(p, 40, GOLD, 0.8, 0.35);

    drawText(p, reg, "KANTIN PULANG SEKOLAH", 12, W / 2, H - 96, GOLD, 400);
    rule(p, 180, 360, H - 112, GOLD, 1, 0.5);

    drawText(p, bold, "THE LAST", 66, W / 2, H - 200, CREAM, W - 100);
    drawText(p, bold, "BARISTA", 66, W / 2, H - 268, GOLD, W - 100);

    cup(p, W / 2, 300, 74, { body: CREAM, liquid: TERRA, outline: GOLD });

    drawText(p, reg, "komik pendek enam halaman", 14, W / 2, 150, CREAM_D, 400);
    drawText(p, reg, "dibuat otomatis di dalam browsermu", 11, W / 2, 128, INK_SOFT, 400);
    drawText(p, bold, "GESER HALAMAN UNTUK MEMULAI", 11, W / 2, 78, GOLD, 420);
    onStep(1, TOTAL);
  }

  // ---- 2. Halaman pembuka ---------------------------------------------
  {
    const p = pageBase(doc);
    frame(p);
    drawText(p, bold, "Pukul 21.47", 30, W / 2, H - 118, INK, W - 120);
    rule(p, 150, 390, H - 142, INK_SOFT, 1, 0.5);

    p.drawRectangle({ x: 62, y: 300, width: W - 124, height: H - 470, color: WHITE, borderColor: INK, borderWidth: 1.4 });
    // jendela kedai
    for (let i = 0; i < 3; i++) {
      p.drawRectangle({ x: 88 + i * 128, y: 420, width: 104, height: 130, color: rgb(0.85, 0.9, 0.95), borderColor: INK, borderWidth: 1.2 });
      p.drawLine({ start: { x: 140 + i * 128, y: 420 }, end: { x: 140 + i * 128, y: 550 }, thickness: 1, color: INK, opacity: 0.6 });
    }
    // meja bar
    p.drawRectangle({ x: 62, y: 300, width: W - 124, height: 66, color: CREAM_D, borderColor: INK, borderWidth: 1.4 });
    barista(p, 168, 366, 46, INK);
    cup(p, 322, 396, 26, { body: WHITE, liquid: TERRA, outline: INK, steam: true });

    drawText(p, reg, "Kedai Kopi Pulang Sekolah sudah tutup sejak dua jam lalu.", 13.5, W / 2, 250, INK, W - 130);
    drawText(p, reg, "Tinggal satu lampu, satu mesin espresso, dan satu barista.", 13.5, W / 2, 228, INK, W - 130);
    pageNumber(p, reg, 2, TOTAL);
    onStep(2, TOTAL);
  }

  // ---- 3. Dialog -------------------------------------------------------
  {
    const p = pageBase(doc);
    frame(p);
    p.drawRectangle({ x: 62, y: 330, width: W - 124, height: H - 420, color: WHITE, borderColor: INK, borderWidth: 1.4 });
    barista(p, 300, 396, 62, INK);
    cup(p, 402, 430, 30, { body: CREAM, liquid: TERRA, outline: INK });

    // balon bicara
    p.drawRectangle({ x: 96, y: H - 250, width: 300, height: 92, borderColor: INK, borderWidth: 1.4, color: WHITE });
    p.drawSvgPath("M 150 0 L 176 0 L 158 -34 Z", { x: 96, y: H - 250, color: WHITE, borderColor: INK, borderWidth: 1.4 });
    drawText(p, reg, "Kamu selalu jadi orang terakhir", 14, 246, H - 190, INK, 270);
    drawText(p, reg, "yang pulang dari kedai ini.", 14, 246, H - 212, INK, 270);

    drawText(p, reg, "Ia tidak menjawab. Tangannya sibuk menakar bubuk,", 13.5, W / 2, 268, INK, W - 130);
    drawText(p, reg, "seperti orang yang sedang menimbang sesuatu yang lain.", 13.5, W / 2, 246, INK, W - 130);
    pageNumber(p, reg, 3, TOTAL);
    onStep(3, TOTAL);
  }

  // ---- 4. Kilas balik ---------------------------------------------------
  {
    const p = pageBase(doc, rgb(0.925, 0.878, 0.804));
    frame(p);
    drawText(p, bold, "DULU, KEDAI INI BERISIK.", 22, W / 2, H - 116, TERRA, W - 120);

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 74 + col * 134;
        const y = 400 - row * 150;
        p.drawRectangle({ x, y, width: 120, height: 130, color: WHITE, borderColor: INK, borderWidth: 1.3 });
        p.drawCircle({ x: x + 40 + (col % 2) * 22, y: y + 92, size: 13, color: INK_SOFT, opacity: 0.85 });
        p.drawSvgPath(`M ${-16} 0 L ${16} 0 L ${11} ${40} L ${-11} ${40} Z`, { x: x + 40 + (col % 2) * 22, y: y + 30, color: INK_SOFT });
        if ((row + col) % 2 === 0) cup(p, x + 92, y + 40, 13, { body: CREAM, liquid: TERRA, outline: INK, steam: false });
      }
    }

    drawText(p, reg, "Enam meja penuh, empat belas cangkir, dua orang tertawa", 13.5, W / 2, 232, INK, W - 130);
    drawText(p, reg, "terlalu keras di pojok. Sekarang kursi-kursi itu terbalik.", 13.5, W / 2, 210, INK, W - 130);
    pageNumber(p, reg, 4, TOTAL);
    onStep(4, TOTAL);
  }

  // ---- 5. Titik balik ---------------------------------------------------
  {
    const p = pageBase(doc, INK);
    frame(p, 26, GOLD, 1.4, 0.7);
    drawText(p, bold, "IA MEMATIKAN MESIN.", 26, W / 2, H - 130, CREAM, W - 120);

    cup(p, W / 2, 400, 82, { body: GOLD, liquid: rgb(0.35, 0.2, 0.12), outline: CREAM, steam: false });
    rule(p, 170, 370, 286, GOLD, 1, 0.4);

    drawText(p, reg, "Cangkir terakhir ia letakkan di meja paling dekat pintu,", 13.5, W / 2, 240, CREAM_D, W - 130);
    drawText(p, reg, "masih panas, untuk siapa pun yang besok datang paling awal.", 13.5, W / 2, 218, CREAM_D, W - 130);
    drawText(p, bold, "TAMAT?", 15, W / 2, 150, GOLD, 300);
    pageNumber(p, reg, 5, TOTAL);
    onStep(5, TOTAL);
  }

  // ---- 6. Penutup -------------------------------------------------------
  {
    const p = pageBase(doc);
    frame(p);
    drawText(p, bold, "TAMAT", 58, W / 2, H - 210, INK, W - 120);
    rule(p, 190, 350, H - 238, INK_SOFT, 1, 0.5);
    cup(p, W / 2, 400, 48, { body: WHITE, liquid: TERRA, outline: INK });

    drawText(p, reg, "Ini hanya komik contoh yang digambar otomatis oleh pdf-lib", 13, W / 2, 250, INK, W - 130);
    drawText(p, reg, "supaya kamu bisa merasakan transisi balik halamannya.", 13, W / 2, 229, INK, W - 130);

    p.drawRectangle({ x: 78, y: 120, width: W - 156, height: 74, color: rgb(0.98, 0.95, 0.89), borderColor: TERRA, borderWidth: 1.3 });
    drawText(p, bold, "Punya komik sendiri?", 13.5, W / 2, 168, TERRA, W - 180);
    drawText(p, reg, "Klik tombol kembali, lalu jatuhkan file PDF-mu di halaman depan.", 12, W / 2, 146, INK_SOFT, W - 180);

    drawText(p, reg, "Flipbook  |  pdf.js + StPageFlip + pdf-lib", 10.5, W / 2, 74, INK_SOFT, W - 130);
    onStep(6, TOTAL);
  }

  const bytes = await doc.save();
  return { bytes, title: "The Last Barista (Demo)" };
}
