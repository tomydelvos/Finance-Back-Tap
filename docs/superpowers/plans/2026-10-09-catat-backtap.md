# Catat Keuangan Back Tap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skrip Google Apps Script (web app) yang menerima transaksi dari Shortcut iOS, menulisnya ke spreadsheet "Keuangan — Back Tap", dan membalas teks ringkasan; ditambah panduan merakit Shortcut dan setup Back Tap.

**Architecture:** Logika murni (parser nominal, validasi, ringkasan, penanganan aksi) dipisah dari akses Google lewat objek `store` sehingga bisa diuji di Node. `Kode.js` hanya menyambungkan `doPost` → `tanganiPermintaan(body, store)` dengan `SheetStore` yang memakai SpreadsheetApp, PropertiesService, dan LockService. Shortcut dirakit manual dari panduan.

**Tech Stack:** Google Apps Script (V8), Node.js 20+ `node:test` + `node:vm` untuk unit test, iOS Shortcuts.

**Spec:** `docs/superpowers/specs/2026-10-09-catat-backtap-design.md`

## Global Constraints

- Zona waktu semua perhitungan "bulan berjalan": `Asia/Jakarta`.
- Nama tab persis: `Transaksi`, `Kategori`, `Ringkasan`. Urutan kolom Transaksi: `ID, Waktu, Jenis, Kategori, Nominal, Catatan, Sumber` (A–G). Kategori: `Nama, Emoji, Jenis, Anggaran Bulanan, Aktif` (A–E). Data mulai baris 2.
- Jenis hanya `Pengeluaran` atau `Pemasukan`; default `Pengeluaran`.
- Nominal rupiah bulat, `1 ≤ n ≤ 1.000.000.000`.
- Catatan dipotong ke 140 karakter.
- Kunci disimpan di Script Properties dengan nama `KUNCI`, 32 karakter acak; tidak pernah ditulis ke spreadsheet.
- Sumber baris dari web app: `Shortcut`.
- Semua balasan JSON berbentuk `{ ok: boolean, pesan: string, ... }`; teks dalam Bahasa Indonesia.
- Format uang di `pesan`: `Rp` + ribuan bertitik, tanpa desimal (`Rp2.400.000`).
- File skrip harus jalan di Apps Script tanpa modul: fungsi global saja, tanpa `import`/`export`/`require`.

## Review Focus

- `Rp25.000,-` dan `25.000,00` (gaya tulisan Indonesia) harus terbaca 25000, bukan ditolak atau dikali 100 → test di Task 1.
- Transaksi tanggal 31 Oktober 23:30 WIB harus masuk bulan Oktober, padahal di UTC sudah sore 31 Oktober/1 November tergantung jam → test batas bulan di Task 2.
- Baris yang diedit manual di Sheets bisa berisi Waktu kosong/teks atau Nominal teks; ringkasan harus melewatinya, bukan error → test di Task 2.
- Nama kategori dikirim dengan beda huruf besar/spasi (`makan & minum `) harus cocok ke `Makan & Minum` → test di Task 3.
- `Lainnya` ada di dua jenis; kategori dicocokkan per jenis sehingga `Lainnya` pemasukan tidak terbaca sebagai pengeluaran → test di Task 3.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `apps-script/Nominal.js` | `parseNominal` |
| `apps-script/Ringkasan.js` | `formatRupiah`, `awalBulanJakarta`, `hitungRingkasan`, `susunPesan` |
| `apps-script/Validasi.js` | `normalisasiNama`, `validasiCatat` |
| `apps-script/Aksi.js` | `tanganiPermintaan(body, store, sekarang)` — routing aksi, cek kunci, dedup, tulis |
| `apps-script/Kode.js` | `doPost`, `SheetStore`, `buatKunci`, `tesCatat` (hanya kode yang menyentuh layanan Google) |
| `apps-script/appsscript.json` | Manifest: `timeZone: Asia/Jakarta`, `runtimeVersion: V8`, `webapp` |
| `tests/muat.js` | Memuat semua file `apps-script/*.js` (kecuali `Kode.js`) ke satu konteks `vm` |
| `tests/*.test.js` | Unit test per file |
| `tests/FakeStore.js` | Store di memori untuk test `Aksi.js` |
| `docs/SETUP.md` | Langkah tempel skrip, `buatKunci`, deploy, uji `curl` |
| `docs/SHORTCUT.md` | Panduan merakit Shortcut "Catat" + Back Tap + uji ujung ke ujung |

**Kontrak `store`** (dipakai `Aksi.js`, diimplementasi `FakeStore` dan `SheetStore`):

```js
store.kunci()                 // -> string | null   (Script Properties KUNCI)
store.kategori()              // -> Array<{nama, emoji, jenis, anggaran:number, aktif:boolean}>
store.adaId(id)               // -> boolean         (cocok persis di kolom A)
store.tambah(baris)           // baris: [id, waktu:Date, jenis, kategori, nominal, catatan, 'Shortcut']
store.transaksi()             // -> Array<[id, waktu, jenis, kategori, nominal, catatan, sumber]> (nilai mentah sel)
store.denganKunci(fn)         // jalankan fn di bawah LockService (Fake: langsung jalankan)
```

---

### Task 1: Harness test + parser nominal

**Files:**
- Create: `package.json`, `tests/muat.js`, `apps-script/Nominal.js`, `tests/Nominal.test.js`

**Interfaces:**
- Produces: `parseNominal(input: string|number|null) -> number|null` — rupiah bulat valid, atau `null` jika tidak valid/di luar 1..1.000.000.000. `muat() -> object` konteks berisi semua fungsi global.

- [ ] **Step 1: Buat `package.json`** dengan `"scripts": { "test": "node --test tests/" }`, tanpa dependency. Buat `tests/muat.js` yang membaca semua `apps-script/*.js` kecuali `Kode.js`, menjalankannya di satu `vm.createContext({})`, dan mengekspor `muat()`.

- [ ] **Step 2: Tulis test gagal `tests/Nominal.test.js`**

```js
const { muat } = require('./muat');
const { parseNominal } = muat();
const ok = { 25000: 25000, '25000': 25000, '25.000': 25000, '25,000': 25000,
  'Rp 25.000': 25000, 'Rp25.000,-': 25000, '25.000,00': 25000, '25rb': 25000,
  '25 rb': 25000, '25k': 25000, '1,5jt': 1500000, '1.5jt': 1500000, '2jt': 2000000,
  '500': 500, ' 75.500 ': 75500, '1000000000': 1000000000 };
for (const [inp, exp] of Object.entries(ok))
  test(`terima ${inp}`, () => assert.strictEqual(parseNominal(inp), exp));
for (const inp of ['', null, '0', '-5000', 'abc', '1000000001', '12,5'])
  test(`tolak ${inp}`, () => assert.strictEqual(parseNominal(inp), null));
test('angka number', () => assert.strictEqual(parseNominal(25000), 25000));
```

(Kunci objek `25000` menjadi string; tambahkan juga test number terpisah seperti di atas.)

- [ ] **Step 3: Jalankan** `npm test` → FAIL, `parseNominal is not defined`.

- [ ] **Step 4: Implement `parseNominal` di `apps-script/Nominal.js`.** Aturan: buang `Rp`, spasi, dan akhiran `,-`; akhiran `rb`/`k` ×1.000, `jt` ×1.000.000 dengan koma/titik di depannya sebagai desimal (`1,5jt`); tanpa akhiran, `,00`/`.00` di ujung dibuang, lalu titik dan koma sebagai pemisah ribuan hanya jika diikuti tepat 3 digit per grup (`12,5` tanpa akhiran → `null`). Hasil dibulatkan ke rupiah bulat lalu dicek 1..1.000.000.000.

- [ ] **Step 5: Jalankan** `npm test` → PASS semua.

- [ ] **Step 6: Commit** `git add package.json tests apps-script/Nominal.js && git commit -m "feat: parser nominal rupiah"`

---

### Task 2: Ringkasan bulan berjalan dan teks pesan

**Files:**
- Create: `apps-script/Ringkasan.js`, `tests/Ringkasan.test.js`

**Interfaces:**
- Consumes: —
- Produces:
  - `formatRupiah(n: number) -> string` (`2400000` → `"Rp2.400.000"`)
  - `awalBulanJakarta(t: Date) -> {mulai: Date, akhir: Date}` — awal bulan ini dan awal bulan depan, dihitung di UTC+7 (Jakarta tanpa DST; boleh pakai offset tetap 7 jam).
  - `hitungRingkasan(transaksi, kategori, sekarang: Date, kategoriDicatat: string, jenis: string) -> {pengeluaran, pemasukan, anggaranTotal, anggaranKategori|null, terpakaiKategori}`
  - `susunPesan({status, nominal, jenis, kategori, emoji, ringkasan, catatanKategori}) -> string`; `status` ∈ `'baru' | 'ganda'`; `catatanKategori` opsional string.

- [ ] **Step 1: Tulis test gagal `tests/Ringkasan.test.js`**

```js
const { formatRupiah, hitungRingkasan, susunPesan } = muat();
const KAT = [ {nama:'Makan & Minum',emoji:'🍜',jenis:'Pengeluaran',anggaran:1500000,aktif:true},
  {nama:'Belanja',emoji:'🛒',jenis:'Pengeluaran',anggaran:1500000,aktif:true},
  {nama:'Gaji',emoji:'💼',jenis:'Pemasukan',anggaran:0,aktif:true} ];
const T = (iso, jenis, kat, n) => ['x', new Date(iso), jenis, kat, n, '', 'Shortcut'];
const now = new Date('2026-10-20T10:00:00+07:00');

test('formatRupiah', () => {
  assert.strictEqual(formatRupiah(2400000), 'Rp2.400.000');
  assert.strictEqual(formatRupiah(500), 'Rp500'); });

test('batas bulan memakai WIB', () => {
  const r = hitungRingkasan([
    T('2026-10-31T23:30:00+07:00','Pengeluaran','Makan & Minum',100),   // Oktober
    T('2026-10-01T00:10:00+07:00','Pengeluaran','Makan & Minum',200),   // Oktober
    T('2026-09-30T23:59:00+07:00','Pengeluaran','Makan & Minum',400),   // September
  ], KAT, new Date('2026-10-31T23:45:00+07:00'), 'Makan & Minum', 'Pengeluaran');
  assert.strictEqual(r.pengeluaran, 300); });

test('baris rusak dilewati', () => {
  const r = hitungRingkasan([
    T('2026-10-05T08:00:00+07:00','Pengeluaran','Belanja',1000),
    ['y','', 'Pengeluaran','Belanja',5000,'',''],          // waktu kosong
    ['z','teks','Pengeluaran','Belanja',5000,'',''],        // waktu teks
    ['w', new Date('2026-10-06T08:00:00+07:00'),'Pengeluaran','Belanja','abc','',''], // nominal teks
  ], KAT, now, 'Belanja', 'Pengeluaran');
  assert.strictEqual(r.pengeluaran, 1000); });

test('anggaran total dan kategori', () => {
  const r = hitungRingkasan([T('2026-10-05T08:00:00+07:00','Pengeluaran','Makan & Minum',450000),
    T('2026-10-06T08:00:00+07:00','Pemasukan','Gaji',8000000)], KAT, now, 'Makan & Minum', 'Pengeluaran');
  assert.deepStrictEqual([r.pengeluaran, r.pemasukan, r.anggaranTotal, r.anggaranKategori, r.terpakaiKategori],
    [450000, 8000000, 3000000, 1500000, 450000]); });

test('pesan pengeluaran lengkap', () => {
  assert.strictEqual(susunPesan({status:'baru', nominal:25000, jenis:'Pengeluaran', kategori:'Makan & Minum', emoji:'🍜',
    ringkasan:{pengeluaran:2400000, pemasukan:0, anggaranTotal:3000000, anggaranKategori:1500000, terpakaiKategori:450000}}),
    'Tersimpan Rp25.000 · 🍜 Makan & Minum\nBulan ini Rp2.400.000 · sisa anggaran Rp600.000\nMakan & Minum: Rp450.000 dari Rp1.500.000'); });

test('pesan tanpa anggaran, ganda, pemasukan, dan catatan kategori', () => {
  const R = {pengeluaran:2400000, pemasukan:8000000, anggaranTotal:0, anggaranKategori:null, terpakaiKategori:0};
  assert.strictEqual(susunPesan({status:'baru', nominal:50000, jenis:'Pengeluaran', kategori:'Belanja', emoji:'🛒', ringkasan:R}),
    'Tersimpan Rp50.000 · 🛒 Belanja\nBulan ini Rp2.400.000');
  assert.strictEqual(susunPesan({status:'ganda', nominal:50000, jenis:'Pengeluaran', kategori:'Belanja', emoji:'🛒', ringkasan:R}),
    'Sudah tercatat Rp50.000 · 🛒 Belanja\nBulan ini Rp2.400.000');
  assert.strictEqual(susunPesan({status:'baru', nominal:8000000, jenis:'Pemasukan', kategori:'Gaji', emoji:'💼', ringkasan:R}),
    'Tersimpan Rp8.000.000 · 💼 Gaji\nPemasukan bulan ini Rp8.000.000');
  assert.strictEqual(susunPesan({status:'baru', nominal:50000, jenis:'Pengeluaran', kategori:'Lainnya', emoji:'📦', ringkasan:R,
    catatanKategori:'Kategori "Snack" tidak dikenal, disimpan sebagai Lainnya'}),
    'Tersimpan Rp50.000 · 📦 Lainnya\nBulan ini Rp2.400.000\nKategori "Snack" tidak dikenal, disimpan sebagai Lainnya'); });
```

Aturan pesan: baris 1 `Tersimpan|Sudah tercatat {Rp} · {emoji} {kategori}`; baris 2 untuk pengeluaran `Bulan ini {Rp pengeluaran}` ditambah ` · sisa anggaran {Rp}` jika `anggaranTotal > 0`; untuk pemasukan `Pemasukan bulan ini {Rp pemasukan}`; baris 3 `{kategori}: {Rp terpakai} dari {Rp anggaran}` hanya untuk pengeluaran dengan `anggaranKategori > 0`; `catatanKategori` jadi baris terakhir jika ada. Sisa anggaran boleh negatif (`-Rp…`).

- [ ] **Step 2: Jalankan** `npm test` → FAIL.
- [ ] **Step 3: Implement** fungsi-fungsi di atas di `apps-script/Ringkasan.js`. Baris dihitung hanya jika `waktu instanceof Date` (cek juga `!isNaN`) dan `typeof nominal === 'number'`. `anggaranTotal` = jumlah anggaran kategori pengeluaran aktif. Format ribuan dengan regex, bukan `toLocaleString` (lokal Apps Script tidak bisa diandalkan).
- [ ] **Step 4: Jalankan** `npm test` → PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: ringkasan bulan berjalan dan teks notifikasi"` (tambahkan file baru dulu).

---

### Task 3: Validasi transaksi

**Files:**
- Create: `apps-script/Validasi.js`, `tests/Validasi.test.js`

**Interfaces:**
- Consumes: `parseNominal` (Task 1).
- Produces:
  - `normalisasiNama(s) -> string` — trim, huruf kecil, spasi ganda jadi satu.
  - `validasiCatat(body, kategori, sekarang: Date) -> {ok:true, data:{id, waktu:Date, jenis, kategori, emoji, nominal, catatan, catatanKategori|null}} | {ok:false, pesan}`

- [ ] **Step 1: Tulis test gagal**

```js
const KAT = [ {nama:'Makan & Minum',emoji:'🍜',jenis:'Pengeluaran',anggaran:0,aktif:true},
  {nama:'Lainnya',emoji:'📦',jenis:'Pengeluaran',anggaran:0,aktif:true},
  {nama:'Hiburan',emoji:'🎬',jenis:'Pengeluaran',anggaran:0,aktif:false},
  {nama:'Gaji',emoji:'💼',jenis:'Pemasukan',anggaran:0,aktif:true},
  {nama:'Lainnya',emoji:'💰',jenis:'Pemasukan',anggaran:0,aktif:true} ];
const now = new Date('2026-10-09T08:00:00+07:00');
const B = (o) => Object.assign({id:'a1', jenis:'Pengeluaran', kategori:'Makan & Minum', nominal:'25rb', catatan:'', waktu:'2026-10-09T08:12:00+07:00'}, o);

test('valid, nama kategori dinormalisasi', () => {
  const r = validasiCatat(B({kategori:' makan  & MINUM '}), KAT, now);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data.kategori, 'Makan & Minum'); assert.strictEqual(r.data.emoji, '🍜');
  assert.strictEqual(r.data.nominal, 25000);
  assert.strictEqual(r.data.waktu.toISOString(), '2026-10-09T01:12:00.000Z'); });
test('Lainnya dicocokkan per jenis', () => {
  assert.strictEqual(validasiCatat(B({jenis:'Pemasukan', kategori:'Lainnya'}), KAT, now).data.emoji, '💰'); });
test('kategori tidak dikenal atau nonaktif jadi Lainnya + catatan', () => {
  for (const k of ['Snack', 'Hiburan']) {
    const r = validasiCatat(B({kategori:k}), KAT, now);
    assert.strictEqual(r.data.kategori, 'Lainnya');
    assert.strictEqual(r.data.catatanKategori, `Kategori "${k}" tidak dikenal, disimpan sebagai Lainnya`); } });
test('jenis kosong jadi Pengeluaran; jenis lain ditolak', () => {
  assert.strictEqual(validasiCatat(B({jenis:''}), KAT, now).data.jenis, 'Pengeluaran');
  assert.deepStrictEqual(validasiCatat(B({jenis:'Transfer'}), KAT, now), {ok:false, pesan:'Jenis harus Pengeluaran atau Pemasukan'}); });
test('nominal tidak valid', () => assert.deepStrictEqual(validasiCatat(B({nominal:'abc'}), KAT, now),
  {ok:false, pesan:'Nominal tidak valid: abc'}));
test('id wajib', () => assert.deepStrictEqual(validasiCatat(B({id:''}), KAT, now), {ok:false, pesan:'ID transaksi kosong'}));
test('waktu tidak valid pakai sekarang; catatan dipotong 140', () => {
  const r = validasiCatat(B({waktu:'kemarin', catatan:'x'.repeat(200)}), KAT, now);
  assert.strictEqual(r.data.waktu.getTime(), now.getTime()); assert.strictEqual(r.data.catatan.length, 140); });
```

- [ ] **Step 2: Jalankan** `npm test` → FAIL.
- [ ] **Step 3: Implement** di `apps-script/Validasi.js`. Jika `Lainnya` untuk jenis itu tidak ada di tab, tetap pakai nama `Lainnya` dengan emoji kosong.
- [ ] **Step 4: Jalankan** `npm test` → PASS.
- [ ] **Step 5: Commit** `"feat: validasi transaksi"`.

---

### Task 4: Penanganan aksi (`kategori`, `catat`)

**Files:**
- Create: `apps-script/Aksi.js`, `tests/FakeStore.js`, `tests/Aksi.test.js`

**Interfaces:**
- Consumes: `validasiCatat` (Task 3), `hitungRingkasan`, `susunPesan` (Task 2), kontrak `store` (File Structure).
- Produces: `tanganiPermintaan(body: object|null, store, sekarang: Date) -> object` (balasan JSON siap di-serialize). `FakeStore({kunci, kategori, transaksi})` dengan properti `baris` (array yang ditambah lewat `tambah`).

- [ ] **Step 1: Tulis test gagal**

`KAT` dan `now` sama dengan Task 3.

```js
const s = () => new FakeStore({kunci:'K', kategori:KAT, transaksi:[]});
test('kunci salah', () => assert.deepStrictEqual(tanganiPermintaan({aksi:'kategori', kunci:'X'}, s(), now), {ok:false, pesan:'Kunci salah'}));
test('kunci belum diatur', () => assert.deepStrictEqual(
  tanganiPermintaan({aksi:'kategori', kunci:'K'}, new FakeStore({kunci:null, kategori:KAT, transaksi:[]}), now),
  {ok:false, pesan:'Kunci belum diatur. Jalankan buatKunci() di editor Apps Script.'}));
test('body bukan JSON / aksi tak dikenal', () => {
  assert.deepStrictEqual(tanganiPermintaan(null, s(), now), {ok:false, pesan:'Permintaan tidak valid'});
  assert.deepStrictEqual(tanganiPermintaan({aksi:'hapus', kunci:'K'}, s(), now), {ok:false, pesan:'Aksi tidak dikenal: hapus'}); });
test('kategori: hanya aktif, dipisah per jenis, urut tab', () => assert.deepStrictEqual(
  tanganiPermintaan({aksi:'kategori', kunci:'K'}, s(), now),
  {ok:true, pesan:'', pengeluaran:[{nama:'Makan & Minum',emoji:'🍜'},{nama:'Lainnya',emoji:'📦'}],
   pemasukan:[{nama:'Gaji',emoji:'💼'},{nama:'Lainnya',emoji:'💰'}]}));
test('catat menambah satu baris berformat benar', () => {
  const st = s(); const r = tanganiPermintaan({aksi:'catat', kunci:'K', id:'a1', jenis:'Pengeluaran',
    kategori:'Makan & Minum', nominal:'25rb', catatan:'kopi', waktu:'2026-10-09T08:12:00+07:00'}, st, now);
  assert.strictEqual(r.ok, true); assert.match(r.pesan, /^Tersimpan Rp25\.000 · 🍜 Makan & Minum/);
  assert.strictEqual(st.baris.length, 1);
  assert.deepStrictEqual(st.baris[0].map(String).slice(2), ['Pengeluaran','Makan & Minum','25000','kopi','Shortcut']); });
test('ID ganda tidak menambah baris', () => {
  const st = s(); const b = {aksi:'catat', kunci:'K', id:'a1', nominal:'25rb', kategori:'Makan & Minum'};
  tanganiPermintaan(b, st, now); const r = tanganiPermintaan(b, st, now);
  assert.strictEqual(st.baris.length, 1); assert.match(r.pesan, /^Sudah tercatat/); });
test('validasi gagal tidak menulis', () => {
  const st = s(); const r = tanganiPermintaan({aksi:'catat', kunci:'K', id:'a2', nominal:'0'}, st, now);
  assert.strictEqual(r.ok, false); assert.strictEqual(st.baris.length, 0); });
test('ringkasan ikut transaksi yang baru ditulis', () => {
  const st = s(); tanganiPermintaan({aksi:'catat', kunci:'K', id:'a1', nominal:'25rb', kategori:'Makan & Minum'}, st, now);
  const r = tanganiPermintaan({aksi:'catat', kunci:'K', id:'a2', nominal:'10rb', kategori:'Makan & Minum'}, st, now);
  assert.match(r.pesan, /\nBulan ini Rp35\.000/); });
```

`FakeStore.transaksi()` mengembalikan transaksi awal + `baris`; `denganKunci(fn)` mengembalikan `fn()`.

- [ ] **Step 2: Jalankan** `npm test` → FAIL.
- [ ] **Step 3: Implement `tanganiPermintaan`** di `apps-script/Aksi.js`. Urutan untuk `catat`: cek kunci → `validasiCatat` → di dalam `store.denganKunci`: `adaId` → `tambah` jika baru → `hitungRingkasan(store.transaksi(), …)` → `susunPesan`. Kunci dibandingkan dengan perbandingan string biasa (pemakaian pribadi).
- [ ] **Step 4: Jalankan** `npm test` → PASS.
- [ ] **Step 5: Commit** `"feat: penanganan aksi kategori dan catat"`.

---

### Task 5: Lapisan Google (`Kode.js`, manifest) + panduan setup

**Files:**
- Create: `apps-script/Kode.js`, `apps-script/appsscript.json`, `docs/SETUP.md`

**Interfaces:**
- Consumes: `tanganiPermintaan` (Task 4), kontrak `store`.
- Produces: `doPost(e)`, `buatKunci()`, `tesCatat()`, `SheetStore()`.

- [ ] **Step 1: Implement `doPost(e)`**: parse `e.postData.contents` (gagal → `null`), panggil `tanganiPermintaan(body, new SheetStore(), new Date())`, kembalikan `ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON)`. Bungkus dengan try/catch: error tak terduga → `{ok:false, pesan:'Terjadi kesalahan di skrip: ' + err.message}`.
- [ ] **Step 2: Implement `SheetStore`** sesuai kontrak `store`: spreadsheet = `SpreadsheetApp.getActiveSpreadsheet()`; `kategori()` membaca `Kategori!A2:E` dan melewati baris tanpa nama, `anggaran` angka atau 0, `aktif === true`; `adaId` memakai `createTextFinder(id).matchEntireCell(true)` pada kolom A Transaksi; `tambah` memakai `appendRow`; `transaksi()` memakai `getRange(2,1,lastRow-1,7).getValues()` (kosong jika `lastRow < 2`); `denganKunci` memakai `LockService.getScriptLock().waitLock(10000)` + `releaseLock()` di `finally`.
- [ ] **Step 3: Implement `buatKunci()`**: 32 karakter dari `Utilities.getUuid()` tanpa tanda hubung, simpan ke Script Properties `KUNCI`, `Logger.log('Kunci baru: ' + k)`. Memanggilnya lagi mengganti kunci lama (tulis ini di SETUP.md).
- [ ] **Step 4: Implement `tesCatat()`**: panggil `tanganiPermintaan` dengan kunci dari properties, `id: 'tes-' + Date.now()`, nominal `'1rb'`, kategori `'Lainnya'`; log balasan; lalu hapus baris terakhir Transaksi jika kolom A-nya sama dengan id tes.
- [ ] **Step 5: Tulis `appsscript.json`**: `{"timeZone":"Asia/Jakarta","runtimeVersion":"V8","exceptionLogging":"STACKDRIVER","webapp":{"executeAs":"USER_DEPLOYING","access":"ANYONE_ANONYMOUS"}}`.
- [ ] **Step 6: Tulis `docs/SETUP.md`**: (1) buka spreadsheet → Ekstensi → Apps Script; (2) buat file `Nominal`, `Ringkasan`, `Validasi`, `Aksi`, `Kode` dan tempel isinya; aktifkan "Tampilkan file manifes" lalu tempel `appsscript.json`; (3) jalankan `buatKunci`, beri izin, salin kunci dari log; (4) jalankan `tesCatat`, pastikan log berisi `"ok":true`; (5) Deploy → Deployment baru → Aplikasi web → Execute as Me, Who has access Anyone → salin URL `/exec`; (6) uji dari terminal Mac:
  `curl -sL -H 'Content-Type: application/json' -d '{"aksi":"kategori","kunci":"<KUNCI>"}' '<URL>'` → JSON berisi daftar kategori; dengan kunci salah → `{"ok":false,"pesan":"Kunci salah"}`; (7) setelah mengubah kode: Deploy → Kelola deployment → edit → Versi baru (URL tetap).
- [ ] **Step 7: Verifikasi** `npm test` masih PASS (Kode.js tidak dimuat oleh harness) dan `node -e "new Function(require('fs').readFileSync('apps-script/Kode.js','utf8'))"` tidak error sintaks.
- [ ] **Step 8: Commit** `"feat: web app Apps Script dan panduan setup"`.

---

### Task 6: Panduan Shortcut "Catat" + uji ujung ke ujung

**Files:**
- Create: `docs/SHORTCUT.md`

**Interfaces:**
- Consumes: kontrak aksi `kategori` dan `catat` (spec bagian 4), URL dan kunci dari SETUP.md.

- [ ] **Step 1: Tulis `docs/SHORTCUT.md`** berisi langkah perakitan dengan nama aksi Shortcuts dalam Bahasa Indonesia dan Inggris, mengikuti spec bagian 5 urutan 1–10. Wajib memuat:
  - Variabel: `Konfigurasi` (Dictionary `url`, `kunci`), `Antrian` (isi `catat-antrian.json`, default list kosong jika file tidak ada).
  - "Get Contents of URL": Method POST, Request Body JSON, field dari Dictionary transaksi.
  - Pembuatan `id`: Format Date pola kustom `yyyyMMddHHmmssSSS` + `-` + Random Number 1000–9999. `waktu`: Format Date ISO 8601.
  - Aturan antrian: tulis dulu (Save File, overwrite, ke `Shortcuts/catat-antrian.json`), lalu Repeat with Each; item dipertahankan hanya jika request berhenti sebelum balasan diterima (karena Shortcut berhenti, ini otomatis); balasan `ok` true atau false → item dibuang; file ditulis ulang setelah loop.
  - Cache kategori `Shortcuts/catat-kategori.json`, termasuk perilaku saat cache belum ada.
  - Menu "💰 Pemasukan…" sebagai item terakhir.
  - Izin "Selalu Izinkan" dan jalur Back Tap: Pengaturan → Aksesibilitas → Sentuh → Ketuk Bagian Belakang → Ketuk Dua Kali → Catat.
- [ ] **Step 2: Tambahkan bagian "Uji ujung ke ujung"** dengan 5 skenario dari spec bagian 7 dalam bentuk checklist beserta hasil yang diharapkan.
- [ ] **Step 3: Rakit di iPhone dan jalankan 5 skenario.** (Dilakukan pemilik iPhone.) Setiap skenario yang gagal dicatat sebagai bug dan diperbaiki lewat superpowers:systematic-debugging sebelum lanjut.
- [ ] **Step 4: Commit** `"docs: panduan Shortcut dan uji ujung ke ujung"`.
