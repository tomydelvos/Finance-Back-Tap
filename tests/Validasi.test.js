const test = require('node:test');
const assert = require('node:assert');
const { muat } = require('./muat');
const { validasiCatat, normalisasiNama } = muat();
// Objek dari konteks vm punya prototype lain; samakan sebelum deepStrictEqual.
const polos = (o) => JSON.parse(JSON.stringify(o));

const KAT = [
  { nama: 'Makan & Minum', emoji: '🍜', jenis: 'Pengeluaran', anggaran: 0, aktif: true },
  { nama: 'Lainnya', emoji: '📦', jenis: 'Pengeluaran', anggaran: 0, aktif: true },
  { nama: 'Hiburan', emoji: '🎬', jenis: 'Pengeluaran', anggaran: 0, aktif: false },
  { nama: 'Gaji', emoji: '💼', jenis: 'Pemasukan', anggaran: 0, aktif: true },
  { nama: 'Lainnya', emoji: '💰', jenis: 'Pemasukan', anggaran: 0, aktif: true },
];
const now = new Date('2026-10-09T08:00:00+07:00');
const B = (o) => Object.assign({ id: 'a1', jenis: 'Pengeluaran', kategori: 'Makan & Minum', nominal: '25rb',
  catatan: '', waktu: '2026-10-09T08:12:00+07:00' }, o);

test('normalisasiNama', () => assert.strictEqual(normalisasiNama('  Makan   &  MINUM '), 'makan & minum'));

test('valid, nama kategori dinormalisasi', () => {
  const r = validasiCatat(B({ kategori: ' makan  & MINUM ' }), KAT, now);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data.kategori, 'Makan & Minum');
  assert.strictEqual(r.data.emoji, '🍜');
  assert.strictEqual(r.data.nominal, 25000);
  assert.strictEqual(r.data.catatanKategori, null);
  assert.strictEqual(r.data.waktu.toISOString(), '2026-10-09T01:12:00.000Z');
});

test('Lainnya dicocokkan per jenis', () => {
  assert.strictEqual(validasiCatat(B({ jenis: 'Pemasukan', kategori: 'Lainnya' }), KAT, now).data.emoji, '💰');
  assert.strictEqual(validasiCatat(B({ kategori: 'Lainnya' }), KAT, now).data.emoji, '📦');
});

test('kategori jenis lain tidak dipakai lintas jenis', () => {
  const r = validasiCatat(B({ kategori: 'Gaji' }), KAT, now);
  assert.strictEqual(r.data.kategori, 'Lainnya');
});

test('kategori tidak dikenal atau nonaktif jadi Lainnya + catatan', () => {
  for (const k of ['Snack', 'Hiburan']) {
    const r = validasiCatat(B({ kategori: k }), KAT, now);
    assert.strictEqual(r.data.kategori, 'Lainnya');
    assert.strictEqual(r.data.catatanKategori, `Kategori "${k}" tidak dikenal, disimpan sebagai Lainnya`);
  }
});

test('kategori kosong jadi Lainnya tanpa catatan', () => {
  const r = validasiCatat(B({ kategori: '' }), KAT, now);
  assert.strictEqual(r.data.kategori, 'Lainnya');
  assert.strictEqual(r.data.catatanKategori, null);
});

test('jenis kosong jadi Pengeluaran; jenis lain ditolak', () => {
  assert.strictEqual(validasiCatat(B({ jenis: '' }), KAT, now).data.jenis, 'Pengeluaran');
  assert.deepStrictEqual(polos(validasiCatat(B({ jenis: 'Transfer' }), KAT, now)),
    { ok: false, pesan: 'Jenis harus Pengeluaran atau Pemasukan' });
});

test('nominal tidak valid', () => assert.deepStrictEqual(polos(validasiCatat(B({ nominal: 'abc' }), KAT, now)),
  { ok: false, pesan: 'Nominal tidak valid: abc' }));

test('id wajib', () => assert.deepStrictEqual(polos(validasiCatat(B({ id: '' }), KAT, now)),
  { ok: false, pesan: 'ID transaksi kosong' }));

test('waktu tidak valid pakai sekarang; catatan dipotong 140', () => {
  const r = validasiCatat(B({ waktu: 'kemarin', catatan: 'x'.repeat(200) }), KAT, now);
  assert.strictEqual(r.data.waktu.getTime(), now.getTime());
  assert.strictEqual(r.data.catatan.length, 140);
});

test('Lainnya tidak ada di tab: tetap Lainnya, emoji kosong', () => {
  const r = validasiCatat(B({ kategori: 'Snack' }), KAT.filter((k) => k.nama !== 'Lainnya'), now);
  assert.strictEqual(r.data.kategori, 'Lainnya');
  assert.strictEqual(r.data.emoji, '');
});
