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
