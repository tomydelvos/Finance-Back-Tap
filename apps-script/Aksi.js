// Penanganan permintaan dari Shortcut. Tidak menyentuh layanan Google secara langsung:
// semua akses data lewat objek `store` (SheetStore di Kode.js, FakeStore di test).

var SUMBER_SHORTCUT = 'Shortcut';
var MENU_KE_PEMASUKAN = '💰 Pemasukan…';

function tanganiPermintaan(body, store, sekarang) {
  if (!body || typeof body !== 'object') return { ok: false, pesan: 'Permintaan tidak valid' };

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
