// Catat Keuangan Back Tap — semua kode dalam satu file.
// Tempel SELURUH isi file ini ke Kode.gs di editor Apps Script.

// ===== Nominal.js =====
// Mengubah input nominal dari Shortcut menjadi rupiah bulat.
// Contoh diterima: 25000, "25.000", "25,000", "Rp 25.000", "Rp25.000,-",
// "25.000,00", "25rb", "25k", "1,5jt", "2jt".
// Mengembalikan null jika tidak valid atau di luar 1..1.000.000.000.

var NOMINAL_MIN = 1;
var NOMINAL_MAKS = 1000000000;
var PENGALI_AKHIRAN = { rb: 1000, k: 1000, jt: 1000000 };

function parseNominal(input) {
  var angka = null;
  if (typeof input === 'number') {
    angka = input;
  } else if (input !== null && input !== undefined) {
    angka = bacaTeksNominal_(String(input));
  }
  if (angka === null || !isFinite(angka)) return null;
  angka = Math.round(angka);
  if (angka < NOMINAL_MIN || angka > NOMINAL_MAKS) return null;
  return angka;
}

function bacaTeksNominal_(teks) {
  var s = teks.toLowerCase().replace(/rp/g, '').replace(/\s+/g, '').replace(/[.,]-$/, '');
  if (s === '') return null;

  var akhiran = s.match(/^(\d+(?:[.,]\d+)?)(rb|k|jt)$/);
  if (akhiran) {
    return parseFloat(akhiran[1].replace(',', '.')) * PENGALI_AKHIRAN[akhiran[2]];
  }

  s = s.replace(/[.,]00$/, '');
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // Pemisah ribuan: titik atau koma, setiap grup tepat 3 digit, satu jenis pemisah.
  if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) {
    return parseInt(s.replace(/[.,]/g, ''), 10);
  }
  return null;
}

// ===== Ringkasan.js =====
// Ringkasan bulan berjalan (WIB) dan teks notifikasi untuk Shortcut.

var OFFSET_WIB_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta, tanpa DST

function formatRupiah(n) {
  var tanda = n < 0 ? '-' : '';
  var ribuan = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return tanda + 'Rp' + ribuan;
}

function adalahTanggalValid_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function awalBulanJakarta(t) {
  var wib = new Date(t.getTime() + OFFSET_WIB_MS);
  var tahun = wib.getUTCFullYear();
  var bulan = wib.getUTCMonth();
  return {
    mulai: new Date(Date.UTC(tahun, bulan, 1) - OFFSET_WIB_MS),
    akhir: new Date(Date.UTC(tahun, bulan + 1, 1) - OFFSET_WIB_MS),
  };
}

// transaksi: baris mentah [id, waktu, jenis, kategori, nominal, catatan, sumber].
function hitungRingkasan(transaksi, kategori, sekarang, kategoriDicatat, jenis) {
  var rentang = awalBulanJakarta(sekarang);
  var hasil = { pengeluaran: 0, pemasukan: 0, anggaranTotal: 0, anggaranKategori: null, terpakaiKategori: 0 };

  transaksi.forEach(function (b) {
    var waktu = b[1], jenisBaris = b[2], namaKategori = b[3], nominal = b[4];
    if (!adalahTanggalValid_(waktu) || typeof nominal !== 'number' || !isFinite(nominal)) return;
    if (waktu < rentang.mulai || waktu >= rentang.akhir) return;
    if (jenisBaris === 'Pengeluaran') {
      hasil.pengeluaran += nominal;
      if (namaKategori === kategoriDicatat) hasil.terpakaiKategori += nominal;
    } else if (jenisBaris === 'Pemasukan') {
      hasil.pemasukan += nominal;
    }
  });

  kategori.forEach(function (k) {
    if (k.jenis !== 'Pengeluaran' || typeof k.anggaran !== 'number' || k.anggaran <= 0) return;
    if (k.aktif) hasil.anggaranTotal += k.anggaran;
    if (jenis === 'Pengeluaran' && k.nama === kategoriDicatat) hasil.anggaranKategori = k.anggaran;
  });

  return hasil;
}

// p: {status: 'baru'|'ganda', nominal, jenis, kategori, emoji, ringkasan, catatanKategori?}
function susunPesan(p) {
  var r = p.ringkasan;
  var label = p.emoji ? p.emoji + ' ' + p.kategori : p.kategori;
  var baris = [(p.status === 'ganda' ? 'Sudah tercatat ' : 'Tersimpan ') + formatRupiah(p.nominal) + ' · ' + label];

  if (p.jenis === 'Pemasukan') {
    baris.push('Pemasukan bulan ini ' + formatRupiah(r.pemasukan));
  } else {
    var total = 'Bulan ini ' + formatRupiah(r.pengeluaran);
    if (r.anggaranTotal > 0) total += ' · sisa anggaran ' + formatRupiah(r.anggaranTotal - r.pengeluaran);
    baris.push(total);
    if (r.anggaranKategori > 0) {
      baris.push(p.kategori + ': ' + formatRupiah(r.terpakaiKategori) + ' dari ' + formatRupiah(r.anggaranKategori));
    }
  }

  if (p.catatanKategori) baris.push(p.catatanKategori);
  return baris.join('\n');
}

// ===== Validasi.js =====
// Validasi body aksi `catat` dari Shortcut.

var JENIS_VALID = ['Pengeluaran', 'Pemasukan'];
var PANJANG_CATATAN_MAKS = 140;
var KATEGORI_CADANGAN = 'Lainnya';

function normalisasiNama(s) {
  return String(s === null || s === undefined ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
}

// Teks yang tampil di menu Shortcut, misalnya "🍜 Makan & Minum".
function labelKategori(k) {
  return k.emoji ? k.emoji + ' ' + k.nama : k.nama;
}

function cariKategori_(kategori, nama, jenis) {
  var dicari = normalisasiNama(nama);
  for (var i = 0; i < kategori.length; i++) {
    var k = kategori[i];
    if (!k.aktif || k.jenis !== jenis) continue;
    if (normalisasiNama(k.nama) === dicari || normalisasiNama(labelKategori(k)) === dicari) return k;
  }
  return null;
}

// Mengembalikan {ok:true, data:{...}} atau {ok:false, pesan}.
function validasiCatat(body, kategori, sekarang) {
  var id = String(body.id === null || body.id === undefined ? '' : body.id).trim();
  if (id === '') return { ok: false, pesan: 'ID transaksi kosong' };

  var jenis = String(body.jenis || '').trim() || 'Pengeluaran';
  if (JENIS_VALID.indexOf(jenis) === -1) return { ok: false, pesan: 'Jenis harus Pengeluaran atau Pemasukan' };

  var nominal = parseNominal(body.nominal);
  if (nominal === null) return { ok: false, pesan: 'Nominal tidak valid: ' + body.nominal };

  var namaDikirim = String(body.kategori || '').trim();
  var cocok = namaDikirim ? cariKategori_(kategori, namaDikirim, jenis) : null;
  var catatanKategori = null;
  if (!cocok) {
    if (namaDikirim) {
      catatanKategori = 'Kategori "' + namaDikirim + '" tidak dikenal, disimpan sebagai ' + KATEGORI_CADANGAN;
    }
    cocok = cariKategori_(kategori, KATEGORI_CADANGAN, jenis) || { nama: KATEGORI_CADANGAN, emoji: '' };
  }

  var waktu = body.waktu ? new Date(body.waktu) : null;
  if (!waktu || isNaN(waktu.getTime())) waktu = new Date(sekarang.getTime());

  return {
    ok: true,
    data: {
      id: id,
      waktu: waktu,
      jenis: jenis,
      kategori: cocok.nama,
      emoji: cocok.emoji || '',
      nominal: nominal,
      catatan: String(body.catatan || '').trim().slice(0, PANJANG_CATATAN_MAKS),
      catatanKategori: catatanKategori,
    },
  };
}

// ===== Aksi.js =====
// Penanganan permintaan dari Shortcut. Tidak menyentuh layanan Google secara langsung:
// semua akses data lewat objek `store` (SheetStore di Kode.js, FakeStore di test).

var SUMBER_SHORTCUT = 'Shortcut';
var MENU_KE_PEMASUKAN = '💰 Pemasukan…';

function tanganiPermintaan(body, store, sekarang) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, pesan: 'Permintaan tidak valid' };

  var kunciTersimpan = store.kunci();
  if (!kunciTersimpan) return { ok: false, pesan: 'Kunci belum diatur. Jalankan buatKunci() di editor Apps Script.' };
  if (String(body.kunci || '') !== kunciTersimpan) return { ok: false, pesan: 'Kunci salah' };

  if (body.aksi === 'kategori') return aksiKategori_(store);
  if (body.aksi === 'catat') return aksiCatat_(body, store, sekarang);
  return { ok: false, pesan: 'Aksi tidak dikenal: ' + body.aksi };
}

function aksiKategori_(store) {
  var hasil = { ok: true, pesan: '', pengeluaran: [], pemasukan: [], menuPengeluaran: [], menuPemasukan: [] };
  store.kategori().forEach(function (k) {
    if (!k.aktif) return;
    var item = { nama: k.nama, emoji: k.emoji || '' };
    if (k.jenis === 'Pengeluaran') {
      hasil.pengeluaran.push(item);
      hasil.menuPengeluaran.push(labelKategori(item));
    } else if (k.jenis === 'Pemasukan') {
      hasil.pemasukan.push(item);
      hasil.menuPemasukan.push(labelKategori(item));
    }
  });
  // Item terakhir menu pertama membuka menu pemasukan (lihat docs/SHORTCUT.md).
  hasil.menuPengeluaran.push(MENU_KE_PEMASUKAN);
  return hasil;
}

function aksiCatat_(body, store, sekarang) {
  var kategori = store.kategori();
  var v = validasiCatat(body, kategori, sekarang);
  if (!v.ok) return v;
  var d = v.data;

  return store.denganKunci(function () {
    var ganda = store.adaId(d.id);
    if (!ganda) {
      store.tambah([d.id, d.waktu, d.jenis, d.kategori, d.nominal, d.catatan, SUMBER_SHORTCUT]);
    }
    var ringkasan = hitungRingkasan(store.transaksi(), kategori, sekarang, d.kategori, d.jenis);
    return {
      ok: true,
      pesan: susunPesan({
        status: ganda ? 'ganda' : 'baru',
        nominal: d.nominal,
        jenis: d.jenis,
        kategori: d.kategori,
        emoji: d.emoji,
        ringkasan: ringkasan,
        catatanKategori: ganda ? null : d.catatanKategori,
      }),
    };
  });
}

// ===== Kode.js =====
// Lapisan Google: satu-satunya file yang memakai SpreadsheetApp, PropertiesService,
// LockService, dan ContentService. Logika ada di Aksi.js, Validasi.js, Ringkasan.js, Nominal.js.

var NAMA_TAB_TRANSAKSI = 'Transaksi';
var NAMA_TAB_KATEGORI = 'Kategori';
var NAMA_PROPERTI_KUNCI = 'KUNCI';
var JUMLAH_KOLOM_TRANSAKSI = 7;
var JUMLAH_KOLOM_KATEGORI = 5;
var TUNGGU_LOCK_MS = 10000;

function doPost(e) {
  var balasan;
  try {
    var body = null;
    try {
      body = JSON.parse(e && e.postData ? e.postData.contents : '');
    } catch (errParse) {
      body = null;
    }
    balasan = tanganiPermintaan(body, new SheetStore(), new Date());
  } catch (err) {
    // Error tak terduga (lock timeout, gangguan Sheets) bersifat sementara:
    // Shortcut menyimpan item di antrian jika pesan diawali "Coba lagi".
    balasan = { ok: false, ulang: true, pesan: 'Coba lagi nanti. Terjadi kesalahan di skrip: ' + err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(balasan)).setMimeType(ContentService.MimeType.JSON);
}

function SheetStore() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  this.tabTransaksi = ss.getSheetByName(NAMA_TAB_TRANSAKSI);
  this.tabKategori = ss.getSheetByName(NAMA_TAB_KATEGORI);
}

SheetStore.prototype.kunci = function () {
  return PropertiesService.getScriptProperties().getProperty(NAMA_PROPERTI_KUNCI);
};

SheetStore.prototype.kategori = function () {
  var akhir = this.tabKategori.getLastRow();
  if (akhir < 2) return [];
  return this.tabKategori.getRange(2, 1, akhir - 1, JUMLAH_KOLOM_KATEGORI).getValues()
    .filter(function (b) { return String(b[0]).trim() !== ''; })
    .map(function (b) {
      return {
        nama: String(b[0]).trim(),
        emoji: String(b[1]).trim(),
        jenis: String(b[2]).trim(),
        anggaran: typeof b[3] === 'number' ? b[3] : 0,
        aktif: b[4] === true,
      };
    });
};

SheetStore.prototype.adaId = function (id) {
  var akhir = this.tabTransaksi.getLastRow();
  if (akhir < 2) return false;
  return this.tabTransaksi.getRange(2, 1, akhir - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext() !== null;
};

SheetStore.prototype.tambah = function (baris) {
  // appendRow menafsirkan teks seperti diketik: catatan "=…", "+…", "-…", "@…"
  // akan jadi rumus atau angka. Apostrof di depan membuatnya tetap teks.
  var salinan = baris.slice();
  var catatan = salinan[5];
  if (typeof catatan === 'string' && /^[=+\-@]/.test(catatan)) salinan[5] = "'" + catatan;
  this.tabTransaksi.appendRow(salinan);
};

SheetStore.prototype.transaksi = function () {
  var akhir = this.tabTransaksi.getLastRow();
  if (akhir < 2) return [];
  return this.tabTransaksi.getRange(2, 1, akhir - 1, JUMLAH_KOLOM_TRANSAKSI).getValues();
};

SheetStore.prototype.denganKunci = function (fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(TUNGGU_LOCK_MS);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
};

// Jalankan sekali dari editor. Menjalankannya lagi mengganti kunci lama.
function buatKunci() {
  var kunci = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(NAMA_PROPERTI_KUNCI, kunci);
  Logger.log('Kunci baru: ' + kunci);
}

// Uji dari editor tanpa iPhone: menulis satu transaksi Rp1.000, mencatat balasan, lalu menghapusnya.
function tesCatat() {
  var store = new SheetStore();
  var id = 'tes-' + Date.now();
  var balasan = tanganiPermintaan(
    { aksi: 'catat', kunci: store.kunci(), id: id, nominal: '1rb', kategori: 'Lainnya', catatan: 'tes skrip' },
    store, new Date());
  Logger.log(JSON.stringify(balasan));
  var akhir = store.tabTransaksi.getLastRow();
  if (akhir >= 2 && store.tabTransaksi.getRange(akhir, 1).getValue() === id) {
    store.tabTransaksi.deleteRow(akhir);
  }
}
