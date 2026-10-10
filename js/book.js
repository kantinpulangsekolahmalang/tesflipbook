/**
 * book.js
 * Pembungkus StPageFlip (vendored sebagai global `St.PageFlip`).
 *
 * Halaman dibangun sebagai elemen DOM <img> lalu dimuat lewat loadFromHTML,
 * sehingga halaman pertama & terakhir bisa jadi "hard cover" (kaku seperti
 * sampul buku) sementara halaman dalam tetap melengkung seperti kertas.
 *
 * --- Cara kerja ukurannya (penting, hasil bedah source StPageFlip) ---
 * 1. StPageFlip memasang `width:100%`, `max-width: 2*maxWidth`, dan
 *    `min-width: minWidth * (usePortrait ? 1 : 2)` pada kontainer.
 *    Jadi `min-width` bisa mengalahkan lebar yang kita set.
 * 2. Orientasi dihitung sendiri oleh library:
 *       portrait  bila  containerWidth < 2 * minWidth
 *       landscape bila  tidak
 * 3. Lebar satu halaman = min(containerWidth / (portrait?1:2), maxWidth),
 *    lalu tingginya di-clamp ke tinggi kontainer dan rasio dijaga.
 *
 * Kesimpulan: untuk memaksa satu halaman kita harus mengatur `minWidth`
 * sedemikian rupa sehingga ambang `2*minWidth` sedikit di atas lebar
 * kontainer yang kita inginkan. Itu yang dilakukan `_applyMode()` di bawah.
 */

/** Tinggi halaman acuan (px) sebelum dibatasi tinggi layar. */
const TARGET_H = 700;
/** Lebar halaman terkecil yang masih layak dibaca. */
const MIN_PAGE_W = 150;
/**
 * Di bawah rasio ini (lebar ruang / lebar satu halaman) dua halaman
 * berdampingan sudah terlalu sempit, jadi paksa satu halaman.
 */
const SPREAD_RATIO = 1.6;
/** Penanda halaman kosong (dipakai saat jumlah halaman genap). */
export const BLANK_MARK = "__blank__";

export class Book {
  /** @param {HTMLElement} container wadah flipbook (#flipbook) */
  constructor(container) {
    this.container = container;
    /** @type {any} instance St.PageFlip */
    this.pf = null;
    this.urls = [];
    this.aspect = 0.7071;
    this.forceSingle = false;
    this.hardCovers = true;
    this.currentIndex = 0;
    this.onChange = () => {};
    this.onMode = () => {};
    this.onState = () => {};

    this._restorePage = 0;
    this._lastKey = "";
    this._fitScheduled = false;
    this._building = false;
    this._settleTimer = 0;
    /** Selang aman sebelum animasi dianggap macet (ms). Bisa diperkecil utk tes. */
    this.settleMs = 1600;
  }

  /* ---------------------------------------------------------------- */
  /* Buka / buka ulang                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * @param {{urls:string[], aspect:number, startPage?:number,
   *          forceSingle?:boolean, hardCovers?:boolean}} cfg
   * @returns {number} indeks halaman saat ini
   */
  open(cfg) {
    const urls = [...cfg.urls];
    if (!urls.length) throw new Error("Tidak ada halaman untuk ditampilkan");

    this.aspect = cfg.aspect > 0.2 && cfg.aspect < 5 ? cfg.aspect : 0.7071;
    this.forceSingle = Boolean(cfg.forceSingle);
    this.hardCovers = cfg.hardCovers !== false && urls.length >= 4;
    this._restorePage = Math.max(0, Math.min(cfg.startPage || 0, urls.length - 1));

    // Sampul buku butuh jumlah halaman ganjil:
    // [cover] [isi berpasangan...] [back cover]
    this.urls = urls.length % 2 === 1 ? urls : [...urls, BLANK_MARK];

    this.destroy();
    this._build();
    return this.currentIndex;
  }

  _build() {
    this._building = true;
    this._lastKey = "";

    const block = document.createElement("div");
    block.className = "book";

    const last = this.urls.length - 1;
    this.urls.forEach((src, i) => {
      const div = document.createElement("div");
      div.className = "page";
      if (this.hardCovers && (i === 0 || i === last)) {
        div.classList.add("page--hard");
        div.dataset.density = "hard";
      }
      if (src === BLANK_MARK) div.classList.add("page--blank");
      else div.appendChild(makeImg(src));
      block.appendChild(div);
    });

    this.container.appendChild(block);

    this.pf = new St.PageFlip(block, this._settings());
    this.pf.loadFromHTML(block.querySelectorAll(".page"));

    this.pf.on("flip", (e) => {
      this.currentIndex = Number(e.data) || 0;
      this.onChange(this.currentIndex, this.getMode());
    });
    this.pf.on("changeOrientation", () => {
      // Orientasi berubah sebagai efek fit(); jangan dibalas fit() lagi.
      if (!this._building) this.onMode(this.getMode());
    });
    this.pf.on("changeState", (e) => {
      this._watch(e.data);
      if (!this._building) this.onState(e.data, this.currentIndex, this.getMode());
    });

    this.scheduleFit();
    if (this._restorePage > 0) this.pf.turnToPage(this._restorePage);
    this.currentIndex = this.pf.getCurrentPageIndex();
    this._building = false;
  }

  destroy() {
    clearTimeout(this._settleTimer);
    this._lastKey = "";
    this._fitScheduled = false;
    if (this.pf) {
      try { this.pf.destroy(); } catch (_) { /* sudah bersih */ }
      this.pf = null;
    }
    this.container.innerHTML = "";
    this.container.style.width = "";
  }

  /* ---------------------------------------------------------------- */
  /* Ukuran & orientasi                                                */
  /* ---------------------------------------------------------------- */

  /** Ruang yang benar-benar tersedia untuk buku. */
  _available() {
    const host = this.container.parentElement || this.container;
    const cs = getComputedStyle(host);
    const num = (v) => parseFloat(v) || 0;
    return {
      w: Math.max(0, host.clientWidth - num(cs.paddingLeft) - num(cs.paddingRight)),
      h: Math.max(0, host.clientHeight - num(cs.paddingTop) - num(cs.paddingBottom)),
    };
  }

  /** Lebar satu halaman yang pas dengan tinggi ruang tersedia. */
  _pageWidthFor(availH) {
    return Math.max(120, Math.round(Math.min(availH, TARGET_H) * this.aspect));
  }

  /** Setting awal; nilai yang bergantung layar diperbarui di _applyMode(). */
  _settings() {
    const avail = this._available();
    const pw = this._pageWidthFor(avail.h > 120 ? avail.h : TARGET_H);

    return {
      width: pw,
      height: Math.round(pw / this.aspect),
      size: "stretch",
      minWidth: MIN_PAGE_W,
      maxWidth: pw * 2,
      minHeight: 200,
      maxHeight: Math.round(pw / this.aspect) * 2,
      maxShadowOpacity: 0.55,
      showCover: true,
      usePortrait: true,
      autoSize: true,
      mobileScrollSupport: false,
      flippingTime: 780,
      drawShadow: true,
      showPageCorners: true,
      disableFlipByClick: false,
      useMouseEvents: true,
      clickEventForward: true,
      swipeDistance: 30,
      startPage: 0,
    };
  }

  /**
   * Hitung lalu terapkan lebar kontainer + batas halaman.
   * @returns {boolean} true bila ada yang diubah
   */
  _applyMode() {
    if (!this.pf) return false;
    const avail = this._available();
    if (avail.w < 60 || avail.h < 60) return false;

    const pw = this._pageWidthFor(avail.h);
    const single = this.forceSingle || avail.w < pw * SPREAD_RATIO;
    const st = this.pf.getSettings();
    if (!st) return false;

    let width;
    if (single) {
      // Ambang portrait library = 2 * minWidth. Naikkan minWidth sampai tepat
      // di atas lebar kontainer, supaya satu halaman tetap tampil besar.
      width = Math.max(MIN_PAGE_W, Math.min(avail.w, pw));
      st.minWidth = Math.floor(width / 2) + 1;
      st.maxWidth = pw;
    } else {
      width = Math.min(avail.w, pw * 2);
      st.minWidth = MIN_PAGE_W;
      st.maxWidth = pw * 2;
    }

    // Dipakai StPageFlip untuk menjaga rasio buku (padding-bottom wrapper).
    st.width = Math.max(MIN_PAGE_W, pw);
    st.height = Math.round(st.width / this.aspect);

    const key = `${Math.round(width)}|${st.minWidth}|${st.maxWidth}`;
    if (key === this._lastKey) return false; // cegah loop update
    this._lastKey = key;

    // StPageFlip menulis min-width / max-width inline HANYA saat loadFromHTML,
    // jadi setelah kita mengubah setting di atas, gaya inline-nya harus
    // disamakan sendiri agar tidak mengalahkan lebar yang kita mau.
    const px = Math.round(width);
    const style = this.container.style;
    style.minWidth = `${px}px`;
    style.width = `${px}px`;
    style.maxWidth = `${Math.max(px, Math.round(pw * 2))}px`;

    this.pf.update();
    return true;
  }

  /** Terapkan ukuran sekarang (dipakai caller yang sudah di luar event loop). */
  fit() {
    this._applyMode();
  }

  /**
   * Pas pertama bisa membuat StPageFlip pindah orientasi; pas kedua mengukur
   * ulang dengan orientasi yang sudah benar.
   */
  scheduleFit() {
    if (this._fitScheduled) return;
    this._fitScheduled = true;
    this._applyMode();
    requestAnimationFrame(() => {
      this._fitScheduled = false;
      this._applyMode();
    });
  }

  getMode() {
    try {
      return this.pf ? this.pf.getOrientation() : "portrait";
    } catch (_) {
      return "portrait";
    }
  }

  /**
   * Watchdog: bila animasi balik halaman tidak pernah selesai (tab pindah ke
   * background, rAF dihentikan, dsb.) buku akan terkunci permanen karena
   * semua perintah navigasi ditahan. Paksa kembali ke keadaan diam.
   */
  _watch(state) {
    clearTimeout(this._settleTimer);
    if (state === "read") return;
    this._settleTimer = setTimeout(() => {
      if (!this.pf) return;
      try {
        if (this.pf.getState() === "read") return;
        this.pf.getFlipController().setState("read");
      } catch (_) { /* biarkan */ }
    }, this.settleMs);
  }

  /**
   * true selama animasi balik halaman berjalan. Navigasi yang dipaksa di
   * tengah animasi bikin StPageFlip salah menghitung spread, jadi ditahan.
   */
  isBusy() {
    try {
      return this.pf ? this.pf.getState() !== "read" : false;
    } catch (_) {
      return false;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Navigasi                                                          */
  /* ---------------------------------------------------------------- */

  getPageCount() {
    return this.urls.length;
  }

  /** @returns {boolean} true bila perintahnya dijalankan */
  next() {
    if (!this.pf || this.isBusy()) return false;
    this.pf.flipNext();
    return true;
  }

  /** @returns {boolean} true bila perintahnya dijalankan */
  prev() {
    if (!this.pf || this.isBusy()) return false;
    this.pf.flipPrev();
    return true;
  }

  /**
   * Lompat langsung ke halaman tertentu (tanpa animasi balik).
   * @returns {boolean} true bila halamannya benar-benar dipindah
   */
  goTo(index) {
    if (!this.pf || this.isBusy()) return false;
    const i = Math.max(0, Math.min(Number(index) || 0, this.urls.length - 1));
    this.pf.turnToPage(i);
    this.currentIndex = i;
    this.onChange(i, this.getMode());
    return true;
  }

  /**
   * Ganti paksa mode satu / dua halaman. Posisi baca dipertahankan.
   * @returns {boolean} true bila sekarang satu halaman
   */
  toggleSpread() {
    if (this.isBusy()) return this.forceSingle;
    const singleNow = this.getMode() === "portrait";
    this.forceSingle = !singleNow;
    this._lastKey = "";
    this._applyMode();
    this.onMode(this.getMode());
    return this.forceSingle;
  }
}

function makeImg(src) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.draggable = false;
  return img;
}
