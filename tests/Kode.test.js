// Menjalankan Kode.js dengan tiruan layanan Google (SpreadsheetApp, dll.)
// untuk menguji sambungan doPost → SheetStore → spreadsheet.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function lembar(baris) {
  return {
    baris,
    getLastRow() { return this.baris.length; },
    getRange(r, c, nr, nc) {
      const self = this;
      return {
        getValues() { return self.baris.slice(r - 1, r - 1 + nr).map((b) => b.slice(c - 1, c - 1 + nc)); },
        getValue() { return self.baris[r - 1][c - 1]; },
        createTextFinder(teks) {
          let persis = false;
          return {
            matchEntireCell(v) { persis = v; return this; },
            findNext() {
              const kolom = self.baris.slice(r - 1, r - 1 + nr).map((b) => String(b[c - 1]));
              return kolom.some((v) => (persis ? v === teks : v.includes(teks))) ? {} : null;
            },
          };
        },
      };
    },
    appendRow(b) { this.baris.push(b); },
    deleteRow(r) { this.baris.splice(r - 1, 1); },
  };
}

function siapkan({ kunci = 'K' } = {}) {
  const props = { KUNCI: kunci };
  const log = [];
  const sheets = {
    Transaksi: lembar([['ID', 'Waktu', 'Jenis', 'Kategori', 'Nominal', 'Catatan', 'Sumber']]),
    Kategori: lembar([
      ['Nama', 'Emoji', 'Jenis', 'Anggaran Bulanan', 'Aktif'],
      ['Makan & Minum', '🍜', 'Pengeluaran', 1500000, true],
      ['', '', '', '', false],
      ['Hiburan', '🎬', 'Pengeluaran', '', false],
      ['Lainnya', '📦', 'Pengeluaran', '', true],
    ]),
  };
  let kunciDipegang = 0;
  const ctx = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheets[n] }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = v; },
    }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { kunciDipegang++; }, releaseLock: () => { kunciDipegang--; } }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ isi: s, setMimeType(m) { this.mime = m; return this; } }),
    },
    Utilities: { getUuid: () => '123e4567-e89b-12d3-a456-426614174000' },
    Logger: { log: (s) => log.push(String(s)) },
  });
  const dir = path.join(__dirname, '..', 'apps-script');
  for (const f of fs.readdirSync(dir).sort()) {
    if (f.endsWith('.js')) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  }
  return { ctx, sheets, props, log, kunciDilepas: () => kunciDipegang === 0 };
}

const post = (ctx, body) => {
  const out = ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } });
  assert.strictEqual(out.mime, 'json');
  return JSON.parse(out.isi);
};

test('doPost aksi kategori membaca tab Kategori', () => {
  const { ctx } = siapkan();
  assert.deepStrictEqual(post(ctx, { aksi: 'kategori', kunci: 'K' }),
    { ok: true, pesan: '', pengeluaran: [{ nama: 'Makan & Minum', emoji: '🍜' }, { nama: 'Lainnya', emoji: '📦' }], pemasukan: [],
      menuPengeluaran: ['🍜 Makan & Minum', '📦 Lainnya', '💰 Pemasukan…'], menuPemasukan: [] });
});

test('doPost catat menulis baris dan melepas lock', () => {
  const s = siapkan();
  const r = post(s.ctx, { aksi: 'catat', kunci: 'K', id: '20261009081200000-1234', nominal: '25rb', kategori: 'Makan & Minum' });
  assert.strictEqual(r.ok, true);
  assert.match(r.pesan, /Makan & Minum: Rp25\.000 dari Rp1\.500\.000/);
  assert.strictEqual(s.sheets.Transaksi.baris.length, 2);
  assert.strictEqual(s.sheets.Transaksi.baris[1][6], 'Shortcut');
  assert.ok(s.kunciDilepas());
  const lagi = post(s.ctx, { aksi: 'catat', kunci: 'K', id: '20261009081200000-1234', nominal: '25rb', kategori: 'Makan & Minum' });
  assert.match(lagi.pesan, /^Sudah tercatat/);
  assert.strictEqual(s.sheets.Transaksi.baris.length, 2);
});

test('doPost body rusak', () => {
  const { ctx } = siapkan();
  assert.deepStrictEqual(post(ctx, '{bukan json'), { ok: false, pesan: 'Permintaan tidak valid' });
});

test('doPost tanpa postData', () => {
  const { ctx } = siapkan();
  const out = ctx.doPost({});
  assert.deepStrictEqual(JSON.parse(out.isi), { ok: false, pesan: 'Permintaan tidak valid' });
});

test('buatKunci menyimpan 32 karakter dan mencatatnya ke log', () => {
  const s = siapkan({ kunci: null });
  s.ctx.buatKunci();
  assert.strictEqual(s.props.KUNCI, '123e4567e89b12d3a456426614174000');
  assert.ok(s.log.some((l) => l.includes('123e4567e89b12d3a456426614174000')));
});

test('tesCatat menulis lalu menghapus baris tes', () => {
  const s = siapkan();
  s.ctx.tesCatat();
  assert.strictEqual(s.sheets.Transaksi.baris.length, 1);
  assert.ok(s.log.some((l) => l.includes('"ok":true')));
});

test('error sementara di skrip ditandai agar Shortcut mencoba lagi', () => {
  const s = siapkan();
  s.ctx.LockService.getScriptLock = () => ({ waitLock: () => { throw new Error('Lock timeout'); }, releaseLock: () => {} });
  const r = post(s.ctx, { aksi: 'catat', kunci: 'K', id: 'b1', nominal: '25rb', kategori: 'Makan & Minum' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.ulang, true);
  assert.strictEqual(r.pesan, 'Coba lagi nanti. Terjadi kesalahan di skrip: Lock timeout');
  assert.strictEqual(s.sheets.Transaksi.baris.length, 1);
});

test('catatan yang diawali = + - @ diberi apostrof agar Sheets tidak menafsirkannya', () => {
  const s = siapkan();
  ['=1+1', '+62812', '-50 diskon', '@budi', 'kopi'].forEach((c, i) =>
    post(s.ctx, { aksi: 'catat', kunci: 'K', id: 'c' + i, nominal: '1rb', kategori: 'Lainnya', catatan: c }));
  assert.deepStrictEqual(s.sheets.Transaksi.baris.slice(1).map((b) => b[5]),
    ["'=1+1", "'+62812", "'-50 diskon", "'@budi", 'kopi']);
});
