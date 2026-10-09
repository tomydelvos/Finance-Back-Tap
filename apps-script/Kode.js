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
    balasan = { ok: false, pesan: 'Terjadi kesalahan di skrip: ' + err.message };
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
  this.tabTransaksi.appendRow(baris);
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
