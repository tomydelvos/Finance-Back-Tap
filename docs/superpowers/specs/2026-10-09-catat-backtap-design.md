# Spesifikasi: Catat Keuangan dengan Back Tap

Tanggal: 9 Oktober 2026 · Status: disetujui per bagian, menunggu review tertulis

## 1. Tujuan dan batasan

**Untuk siapa:** pemakaian pribadi (satu orang, satu iPhone, satu akun Google).

**Masalah:** mencatat pengeluaran terlalu repot sehingga sering lupa.

**Hasil yang diinginkan:**
- Ketuk dua kali belakang iPhone, isi nominal dan kategori, notifikasi "Tersimpan" dalam ≤ 5 detik.
- Semua data ada di Google Sheets milik sendiri.
- Ringkasan bulanan bisa dilihat di Google Sheets dan langsung di notifikasi Shortcut.

**Di luar cakupan:** server, database, halaman web, login, multi-pengguna, Android, edit atau hapus transaksi lewat Shortcut, sinkronisasi bank.

**Pendekatan terpilih (A):** Shortcut iOS → Google Apps Script (web app) → Google Sheets. Tanpa hosting dan tanpa biaya.

## 2. Komponen

| Komponen | Tempat | Tanggung jawab |
|---|---|---|
| Spreadsheet "Keuangan — Back Tap" | Google Drive pengguna | Menyimpan transaksi, kategori, anggaran, dan ringkasan |
| Skrip Apps Script | Terpasang di spreadsheet, di-deploy sebagai web app | Memeriksa kunci, memvalidasi, menulis baris, menghitung ringkasan |
| Shortcut "Catat" | iPhone | Menu input, antrian offline, mengirim, menampilkan notifikasi |
| Back Tap | Pengaturan iOS | Menjalankan Shortcut dengan ketuk dua kali |

## 3. Spreadsheet (sudah dibuat)

Zona waktu Asia/Jakarta, lokal Indonesia (pemisah rumus `;`, format `Rp25.000`).

**Transaksi** — satu baris per transaksi, hanya ditulis oleh skrip atau diedit manual.

| Kolom | Isi |
|---|---|
| A `ID` | Teks unik dari Shortcut; mencegah baris ganda |
| B `Waktu` | Tanggal-jam, format `dd/mm/yyyy hh:mm` |
| C `Jenis` | `Pengeluaran` atau `Pemasukan` |
| D `Kategori` | Nama dari tab Kategori |
| E `Nominal` | Rupiah bulat > 0, format `Rp#,##0` |
| F `Catatan` | Opsional |
| G `Sumber` | `Shortcut` atau `Manual` |

**Kategori** — `Nama · Emoji · Jenis · Anggaran Bulanan · Aktif`. Bawaan: Makan & Minum 🍜, Transportasi 🛵, Belanja 🛒, Tagihan 🧾, Hiburan 🎬, Kesehatan 💊, Lainnya 📦 (pengeluaran); Gaji 💼, Lainnya 💰 (pemasukan). Anggaran diisi pengguna (boleh kosong).

**Ringkasan** — sel B3 memilih bulan (default bulan berjalan). Berisi total pengeluaran, pemasukan, selisih, anggaran, sisa anggaran; tabel per kategori; pengeluaran harian; tren 6 bulan; tiga grafik. Semua berupa rumus atas tab Transaksi dan Kategori.

**Koreksi data:** edit atau hapus baris langsung di tab Transaksi.

## 4. Skrip Apps Script

**Deploy:** web app, *Execute as: Me*, *Who has access: Anyone*. Akses dijaga oleh kunci rahasia.

**Kunci:** fungsi `buatKunci()` dijalankan sekali dari editor; membuat kunci acak 32 karakter, menyimpannya di Script Properties (`KUNCI`), dan menuliskannya ke log untuk disalin ke Shortcut. Kunci tidak pernah disimpan di spreadsheet.

**Kontrak:** semua permintaan `POST` dengan body JSON object; semua balasan JSON `{ "ok": boolean, "pesan": string, ... }` (Apps Script tidak bisa mengatur kode status HTTP). Error tak terduga di skrip dibalas `{ ok: false, ulang: true, pesan: "Coba lagi nanti. Terjadi kesalahan di skrip: …" }`.

### Aksi `kategori`
- Request: `{ "aksi": "kategori", "kunci": "…" }`
- Balasan: `{ "ok": true, "pengeluaran": [{ "nama", "emoji" }], "pemasukan": [{ "nama", "emoji" }], "menuPengeluaran": ["🍜 Makan & Minum", …, "💰 Pemasukan…"], "menuPemasukan": ["💼 Gaji", …] }` — hanya kategori dengan Aktif = TRUE, urut sesuai tab. `menu…` berisi label siap tampil (emoji + spasi + nama, atau nama saja jika emoji kosong).

### Aksi `catat`
- Request: `{ "aksi": "catat", "kunci", "id", "jenis", "kategori", "nominal", "catatan", "waktu" }`
- Langkah:
  1. Kunci salah → `{ ok: false, pesan: "Kunci salah" }`.
  2. Validasi:
     - `jenis` harus `Pengeluaran` atau `Pemasukan` (default `Pengeluaran` jika kosong).
     - `nominal` diterima sebagai angka atau teks: `25000`, `25.000`, `25,000`, `Rp 25.000`, `25rb`, `25k`, `1,5jt`, `1.5jt` → rupiah bulat. Harus > 0 dan ≤ 1.000.000.000; selain itu `ok: false`.
     - `kategori` boleh berupa nama atau label menu (`🍜 Makan & Minum`); dicocokkan tanpa membedakan huruf besar/spasi, per jenis.
     - `kategori` yang tidak ada atau tidak aktif untuk jenis itu → disimpan sebagai `Lainnya`, dan `pesan` menyebutkannya.
     - `id` wajib; kosong → `ok: false`.
     - `waktu` ISO 8601; kosong atau tidak valid → waktu server.
     - `catatan` dipotong ke 140 karakter.
  3. `LockService.getScriptLock()` (tunggu ≤ 10 detik) agar kiriman bersamaan tidak saling menimpa.
  4. Cari `id` di kolom A (cocok persis). Jika sudah ada → tidak menambah baris, `pesan` diawali "Sudah tercatat".
  5. Tambah baris dengan `Sumber = Shortcut`. Catatan yang diawali `=`, `+`, `-`, `@` diberi apostrof agar tidak ditafsirkan sebagai rumus/angka; kolom Catatan berformat teks.
  6. Hitung ringkasan **bulan berjalan** (zona Asia/Jakarta) langsung dari tab Transaksi dan Kategori, bukan dari tab Ringkasan.
- Balasan sukses: `{ ok: true, pesan }`, contoh:
  `Tersimpan Rp25.000 · 🍜 Makan & Minum`
  `Bulan ini Rp2.400.000 · sisa anggaran Rp600.000`
  `Makan & Minum: Rp450.000 dari Rp1.500.000`
  - Baris anggaran total hanya muncul jika total anggaran > 0; baris kategori hanya jika kategori itu punya anggaran. Untuk pemasukan, baris kedua menjadi `Pemasukan bulan ini Rp…`.

### Fungsi bantu
- `tesCatat()` — dijalankan dari editor; menulis satu transaksi tes lewat logika yang sama, mencatat balasan ke log, lalu menghapus baris tes.

## 5. Shortcut "Catat"

**Prinsip:** setiap transaksi ditulis ke antrian dulu, baru dikirim. Shortcuts tidak bisa menangkap error jaringan, jadi kalau koneksi putus Shortcut berhenti, tetapi transaksi aman di antrian dan dikirim pada run berikutnya. Cek ID di skrip mencegah baris ganda.

**File (iCloud Drive/Shortcuts/):** `catat-antrian.json` (daftar transaksi belum terkirim), `catat-kategori.json` (cache balasan aksi `kategori`).

**Alur:**
1. Dictionary konfigurasi: `url`, `kunci`.
2. Baca cache kategori. Jika belum ada, panggil aksi `kategori` dulu dan simpan.
3. Menu: kategori pengeluaran (emoji + nama), item terakhir "💰 Pemasukan…" membuka menu kategori pemasukan.
4. Ask for Input (Number): "Berapa?".
5. Ask for Input (Text, boleh kosong): "Catatan?".
6. Susun transaksi: `id` = tanggal `yyyyMMddHHmmssSSS` + `-` + angka acak 1000–9999; `waktu` = tanggal sekarang ISO 8601; `aksi = catat` + kunci + jenis, kategori, nominal, catatan.
7. Tambahkan ke `catat-antrian.json`.
8. Kirim tiap item antrian dengan POST JSON dan tampilkan `pesan` tiap balasan sebagai notifikasi. Item **tetap di antrian** jika `pesan` kosong (Google membalas halaman error) atau diawali `Coba lagi`; selain itu item dihapus, termasuk yang ditolak permanen. Tulis ulang file antrian berisi item yang tersisa.
9. Jika menu kategori tidak bisa didapat (cache kosong dan skrip menolak), tampilkan `pesan` lalu hentikan Shortcut. Cache hanya disimpan jika balasan berisi `menuPengeluaran`.
10. Panggil aksi `kategori` dan perbarui cache.

**Setup iPhone:**
1. Rakit Shortcut, isi `url` dan `kunci`.
2. Jalankan sekali; pilih **Selalu Izinkan** untuk script.google.com dan akses file iCloud.
3. Pengaturan → Aksesibilitas → Sentuh → Ketuk Bagian Belakang → Ketuk Dua Kali → **Catat**.

## 6. Penanganan kegagalan

| Situasi | Perilaku |
|---|---|
| Offline / timeout | iOS menampilkan error jaringan; transaksi tetap di antrian; terkirim pada run berikutnya |
| Kunci salah | Notifikasi "Kunci salah"; item dibuang dari antrian |
| Nominal tidak valid | Notifikasi dengan alasannya; item dibuang |
| Kategori tidak dikenal | Disimpan sebagai "Lainnya"; disebut di notifikasi |
| ID sudah ada | Tidak ada baris baru; notifikasi "Sudah tercatat" + ringkasan |
| Dua kiriman bersamaan | LockService menyerialkan penulisan |
| Error sementara di skrip / halaman error Google | Item tetap di antrian, dikirim ulang pada run berikutnya |
| Salah catat | Edit/hapus baris di tab Transaksi |

## 7. Pengujian

- **Skrip:** fungsi parser nominal diuji dengan semua contoh format di bagian 4 (termasuk nilai yang harus ditolak: `0`, `-5000`, `abc`, kosong). `tesCatat()` lolos dari editor.
- **Ujung ke ujung (manual di iPhone):**
  1. Catat pengeluaran online → baris muncul, notifikasi berisi ringkasan, tab Ringkasan berubah.
  2. Catat dengan mode pesawat → error jaringan; matikan mode pesawat; catat lagi → kedua transaksi masuk, tidak ada duplikat.
  3. Ubah kunci di Shortcut menjadi salah → notifikasi "Kunci salah", tidak ada baris baru.
  4. Nonaktifkan satu kategori di Sheets → setelah satu kali catat, kategori itu hilang dari menu.
  5. Back Tap menjalankan Shortcut; waktu dari ketuk sampai notifikasi ≤ 5 detik.

## 8. Lampiran

- Spreadsheet: https://docs.google.com/spreadsheets/d/1N26hAs8tzHLo9MH-WYN6zh3pE9SzY1JsmvHSmpSy660/edit
- Diagram alur: `alur-catat-backtap.html`
