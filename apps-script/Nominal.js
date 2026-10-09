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
