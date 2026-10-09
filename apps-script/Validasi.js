// Validasi body aksi `catat` dari Shortcut.

var JENIS_VALID = ['Pengeluaran', 'Pemasukan'];
var PANJANG_CATATAN_MAKS = 140;
var KATEGORI_CADANGAN = 'Lainnya';

function normalisasiNama(s) {
  return String(s === null || s === undefined ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
}

function cariKategori_(kategori, nama, jenis) {
  var dicari = normalisasiNama(nama);
  for (var i = 0; i < kategori.length; i++) {
    var k = kategori[i];
    if (k.aktif && k.jenis === jenis && normalisasiNama(k.nama) === dicari) return k;
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
