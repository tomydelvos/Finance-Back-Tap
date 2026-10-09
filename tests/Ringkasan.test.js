const test = require('node:test');
const assert = require('node:assert');
const { muat } = require('./muat');
const { formatRupiah, hitungRingkasan, susunPesan } = muat();

const KAT = [
  { nama: 'Makan & Minum', emoji: '🍜', jenis: 'Pengeluaran', anggaran: 1500000, aktif: true },
  { nama: 'Belanja', emoji: '🛒', jenis: 'Pengeluaran', anggaran: 1500000, aktif: true },
  { nama: 'Gaji', emoji: '💼', jenis: 'Pemasukan', anggaran: 0, aktif: true },
];
const T = (iso, jenis, kat, n) => ['x', new Date(iso), jenis, kat, n, '', 'Shortcut'];
const now = new Date('2026-10-20T10:00:00+07:00');

test('formatRupiah', () => {
  assert.strictEqual(formatRupiah(2400000), 'Rp2.400.000');
  assert.strictEqual(formatRupiah(500), 'Rp500');
  assert.strictEqual(formatRupiah(-25000), '-Rp25.000');
});

test('batas bulan memakai WIB', () => {
  const r = hitungRingkasan([
    T('2026-10-31T23:30:00+07:00', 'Pengeluaran', 'Makan & Minum', 100),
    T('2026-10-01T00:10:00+07:00', 'Pengeluaran', 'Makan & Minum', 200),
    T('2026-09-30T23:59:00+07:00', 'Pengeluaran', 'Makan & Minum', 400),
    T('2026-11-01T00:00:00+07:00', 'Pengeluaran', 'Makan & Minum', 800),
  ], KAT, new Date('2026-10-31T23:45:00+07:00'), 'Makan & Minum', 'Pengeluaran');
  assert.strictEqual(r.pengeluaran, 300);
});

test('baris rusak dilewati', () => {
  const r = hitungRingkasan([
    T('2026-10-05T08:00:00+07:00', 'Pengeluaran', 'Belanja', 1000),
    ['y', '', 'Pengeluaran', 'Belanja', 5000, '', ''],
    ['z', 'teks', 'Pengeluaran', 'Belanja', 5000, '', ''],
    ['w', new Date('2026-10-06T08:00:00+07:00'), 'Pengeluaran', 'Belanja', 'abc', '', ''],
    ['v', new Date('invalid'), 'Pengeluaran', 'Belanja', 5000, '', ''],
  ], KAT, now, 'Belanja', 'Pengeluaran');
  assert.strictEqual(r.pengeluaran, 1000);
});

test('anggaran total dan kategori', () => {
  const r = hitungRingkasan([
    T('2026-10-05T08:00:00+07:00', 'Pengeluaran', 'Makan & Minum', 450000),
    T('2026-10-06T08:00:00+07:00', 'Pemasukan', 'Gaji', 8000000),
  ], KAT, now, 'Makan & Minum', 'Pengeluaran');
  assert.deepStrictEqual(
    [r.pengeluaran, r.pemasukan, r.anggaranTotal, r.anggaranKategori, r.terpakaiKategori],
    [450000, 8000000, 3000000, 1500000, 450000]);
});

test('pesan pengeluaran lengkap', () => {
  assert.strictEqual(susunPesan({ status: 'baru', nominal: 25000, jenis: 'Pengeluaran', kategori: 'Makan & Minum', emoji: '🍜',
    ringkasan: { pengeluaran: 2400000, pemasukan: 0, anggaranTotal: 3000000, anggaranKategori: 1500000, terpakaiKategori: 450000 } }),
    'Tersimpan Rp25.000 · 🍜 Makan & Minum\nBulan ini Rp2.400.000 · sisa anggaran Rp600.000\nMakan & Minum: Rp450.000 dari Rp1.500.000');
});

test('pesan tanpa anggaran, ganda, pemasukan, dan catatan kategori', () => {
  const R = { pengeluaran: 2400000, pemasukan: 8000000, anggaranTotal: 0, anggaranKategori: null, terpakaiKategori: 0 };
  assert.strictEqual(susunPesan({ status: 'baru', nominal: 50000, jenis: 'Pengeluaran', kategori: 'Belanja', emoji: '🛒', ringkasan: R }),
    'Tersimpan Rp50.000 · 🛒 Belanja\nBulan ini Rp2.400.000');
  assert.strictEqual(susunPesan({ status: 'ganda', nominal: 50000, jenis: 'Pengeluaran', kategori: 'Belanja', emoji: '🛒', ringkasan: R }),
    'Sudah tercatat Rp50.000 · 🛒 Belanja\nBulan ini Rp2.400.000');
  assert.strictEqual(susunPesan({ status: 'baru', nominal: 8000000, jenis: 'Pemasukan', kategori: 'Gaji', emoji: '💼', ringkasan: R }),
    'Tersimpan Rp8.000.000 · 💼 Gaji\nPemasukan bulan ini Rp8.000.000');
  assert.strictEqual(susunPesan({ status: 'baru', nominal: 50000, jenis: 'Pengeluaran', kategori: 'Lainnya', emoji: '📦', ringkasan: R,
    catatanKategori: 'Kategori "Snack" tidak dikenal, disimpan sebagai Lainnya' }),
    'Tersimpan Rp50.000 · 📦 Lainnya\nBulan ini Rp2.400.000\nKategori "Snack" tidak dikenal, disimpan sebagai Lainnya');
});

test('sisa anggaran negatif', () => {
  const R = { pengeluaran: 3100000, pemasukan: 0, anggaranTotal: 3000000, anggaranKategori: null, terpakaiKategori: 0 };
  assert.strictEqual(susunPesan({ status: 'baru', nominal: 100000, jenis: 'Pengeluaran', kategori: 'Belanja', emoji: '🛒', ringkasan: R }),
    'Tersimpan Rp100.000 · 🛒 Belanja\nBulan ini Rp3.100.000 · sisa anggaran -Rp100.000');
});

test('emoji kosong tidak menyisakan spasi ganda', () => {
  const R = { pengeluaran: 1000, pemasukan: 0, anggaranTotal: 0, anggaranKategori: null, terpakaiKategori: 0 };
  assert.strictEqual(susunPesan({ status: 'baru', nominal: 1000, jenis: 'Pengeluaran', kategori: 'Lainnya', emoji: '', ringkasan: R }),
    'Tersimpan Rp1.000 · Lainnya\nBulan ini Rp1.000');
});
