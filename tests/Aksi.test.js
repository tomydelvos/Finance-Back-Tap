const test = require('node:test');
const assert = require('node:assert');
const { muat } = require('./muat');
const { FakeStore } = require('./FakeStore');
const { tanganiPermintaan } = muat();
const polos = (o) => JSON.parse(JSON.stringify(o));

const KAT = [
  { nama: 'Makan & Minum', emoji: '🍜', jenis: 'Pengeluaran', anggaran: 0, aktif: true },
  { nama: 'Lainnya', emoji: '📦', jenis: 'Pengeluaran', anggaran: 0, aktif: true },
  { nama: 'Hiburan', emoji: '🎬', jenis: 'Pengeluaran', anggaran: 0, aktif: false },
  { nama: 'Gaji', emoji: '💼', jenis: 'Pemasukan', anggaran: 0, aktif: true },
  { nama: 'Lainnya', emoji: '💰', jenis: 'Pemasukan', anggaran: 0, aktif: true },
];
const now = new Date('2026-10-09T08:00:00+07:00');
const s = () => new FakeStore({ kunci: 'K', kategori: KAT, transaksi: [] });

test('kunci salah', () => assert.deepStrictEqual(polos(tanganiPermintaan({ aksi: 'kategori', kunci: 'X' }, s(), now)),
  { ok: false, pesan: 'Kunci salah' }));

test('kunci belum diatur', () => assert.deepStrictEqual(polos(
  tanganiPermintaan({ aksi: 'kategori', kunci: 'K' }, new FakeStore({ kunci: null, kategori: KAT, transaksi: [] }), now)),
  { ok: false, pesan: 'Kunci belum diatur. Jalankan buatKunci() di editor Apps Script.' }));

test('kunci kosong tidak cocok dengan kunci yang belum diatur', () => assert.deepStrictEqual(polos(
  tanganiPermintaan({ aksi: 'kategori', kunci: '' }, new FakeStore({ kunci: '', kategori: KAT, transaksi: [] }), now)),
  { ok: false, pesan: 'Kunci belum diatur. Jalankan buatKunci() di editor Apps Script.' }));

test('body bukan JSON / aksi tak dikenal', () => {
  assert.deepStrictEqual(polos(tanganiPermintaan(null, s(), now)), { ok: false, pesan: 'Permintaan tidak valid' });
  assert.deepStrictEqual(polos(tanganiPermintaan({ aksi: 'hapus', kunci: 'K' }, s(), now)),
    { ok: false, pesan: 'Aksi tidak dikenal: hapus' });
});

test('kategori: hanya aktif, dipisah per jenis, urut tab', () => assert.deepStrictEqual(
  polos(tanganiPermintaan({ aksi: 'kategori', kunci: 'K' }, s(), now)),
  { ok: true, pesan: '', pengeluaran: [{ nama: 'Makan & Minum', emoji: '🍜' }, { nama: 'Lainnya', emoji: '📦' }],
    pemasukan: [{ nama: 'Gaji', emoji: '💼' }, { nama: 'Lainnya', emoji: '💰' }] }));

test('catat menambah satu baris berformat benar', () => {
  const st = s();
  const r = tanganiPermintaan({ aksi: 'catat', kunci: 'K', id: 'a1', jenis: 'Pengeluaran',
    kategori: 'Makan & Minum', nominal: '25rb', catatan: 'kopi', waktu: '2026-10-09T08:12:00+07:00' }, st, now);
  assert.strictEqual(r.ok, true);
  assert.match(r.pesan, /^Tersimpan Rp25\.000 · 🍜 Makan & Minum/);
  assert.strictEqual(st.baris.length, 1);
  assert.strictEqual(st.baris[0][0], 'a1');
  assert.strictEqual(st.baris[0][1].toISOString(), '2026-10-09T01:12:00.000Z');
  assert.deepStrictEqual(Array.from(st.baris[0].slice(2), String), ['Pengeluaran', 'Makan & Minum', '25000', 'kopi', 'Shortcut']);
  assert.strictEqual(typeof st.baris[0][4], 'number');
});

test('ID ganda tidak menambah baris', () => {
  const st = s();
  const b = { aksi: 'catat', kunci: 'K', id: 'a1', nominal: '25rb', kategori: 'Makan & Minum' };
  tanganiPermintaan(b, st, now);
  const r = tanganiPermintaan(b, st, now);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(st.baris.length, 1);
  assert.match(r.pesan, /^Sudah tercatat/);
});

test('validasi gagal tidak menulis', () => {
  const st = s();
  const r = tanganiPermintaan({ aksi: 'catat', kunci: 'K', id: 'a2', nominal: '0' }, st, now);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(st.baris.length, 0);
});

test('ringkasan ikut transaksi yang baru ditulis', () => {
  const st = s();
  tanganiPermintaan({ aksi: 'catat', kunci: 'K', id: 'a1', nominal: '25rb', kategori: 'Makan & Minum' }, st, now);
  const r = tanganiPermintaan({ aksi: 'catat', kunci: 'K', id: 'a2', nominal: '10rb', kategori: 'Makan & Minum' }, st, now);
  assert.match(r.pesan, /\nBulan ini Rp35\.000/);
});
