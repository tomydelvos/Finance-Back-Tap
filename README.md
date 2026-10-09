# Catat Keuangan dengan Back Tap

Ketuk dua kali bagian belakang iPhone, pilih kategori, isi nominal. Transaksi masuk ke Google Sheets milik Anda, dan notifikasi langsung menunjukkan total bulan ini serta sisa anggaran.

Spreadsheet: [Keuangan — Back Tap](https://docs.google.com/spreadsheets/d/1N26hAs8tzHLo9MH-WYN6zh3pE9SzY1JsmvHSmpSy660/edit)

## Tahapan penggunaan

### Tahap 1 — Pasang skrip (sekali, di laptop, ±10 menit)

Ikuti `docs/SETUP.md`: tempel 5 file skrip ke spreadsheet, jalankan `buatKunci`, uji dengan `tesCatat`, lalu deploy sebagai web app.
Hasilnya **URL web app** dan **kunci**. Simpan keduanya.

### Tahap 2 — Rakit Shortcut dan Back Tap (sekali, di iPhone, ±20 menit)

Ikuti `docs/SHORTCUT.md` bagian A–F, beri izin pada run pertama, lalu pasang Back Tap:
**Pengaturan → Aksesibilitas → Sentuh → Ketuk Bagian Belakang → Ketuk Dua Kali → Catat**.

### Tahap 3 — Uji (sekali, ±10 menit)

Jalankan 5 skenario di bagian "Uji ujung ke ujung" pada `docs/SHORTCUT.md`, lalu hapus baris uji dari tab Transaksi.

### Tahap 4 — Pakai sehari-hari

| Mau apa | Caranya |
|---|---|
| **Catat pengeluaran** | Ketuk dua kali belakang iPhone → pilih kategori → ketik nominal → catatan (boleh kosong) → Selesai. Notifikasi muncul dalam beberapa detik. |
| **Catat pemasukan** | Sama, tapi pilih **💰 Pemasukan…** di paling bawah menu, lalu pilih kategorinya. |
| **Lihat ringkasan** | Buka app Google Sheets → **Keuangan — Back Tap** → tab **Ringkasan**. Isi total, sisa anggaran, per kategori, harian, tren 6 bulan, dan grafik. |
| **Lihat bulan lain** | Di tab Ringkasan, ubah sel biru **B3** ke tanggal mana pun di bulan itu. |
| **Atur anggaran** | Tab **Kategori** → isi kolom **Anggaran Bulanan**. Notifikasi berikutnya ikut menampilkan sisa anggaran. |
| **Tambah atau ubah kategori** | Tab **Kategori** → tambah baris (Nama, Emoji, Jenis, centang Aktif). Menu Shortcut ikut berubah setelah satu kali mencatat. |
| **Sembunyikan kategori** | Hapus centang **Aktif**. Data lama tetap ada. |
| **Salah catat** | Tab **Transaksi** → edit atau hapus barisnya. Ringkasan langsung menyesuaikan. |
| **Catat manual dari Sheets** | Tambah baris di tab Transaksi, isi Sumber `Manual`. Kolom ID boleh diisi teks apa pun yang unik. |
| **Sedang offline** | Catat seperti biasa. iOS akan menampilkan error, tapi transaksi tersimpan di antrian dan terkirim otomatis saat Anda mencatat lagi dengan internet. |

### Kalau ada masalah

| Notifikasi / gejala | Artinya | Yang dilakukan |
|---|---|---|
| `Kunci salah` | Kunci di Shortcut berbeda dengan di skrip | Samakan `kunci` di langkah A.1 dengan kunci dari `buatKunci` |
| `Kunci belum diatur…` | `buatKunci` belum pernah dijalankan | Jalankan `buatKunci` di editor Apps Script |
| `Nominal tidak valid: …` | Nominal 0, negatif, atau di atas Rp1 miliar | Catat ulang dengan nominal yang benar |
| `Kategori "…" tidak dikenal…` | Kategori sudah dihapus atau dinonaktifkan | Transaksi tetap tersimpan sebagai Lainnya; ubah di tab Transaksi bila perlu |
| `Sudah tercatat …` | Transaksi ini sudah ada (biasanya dari antrian) | Tidak perlu apa-apa |
| `Permintaan tidak valid` | Format kiriman Shortcut tidak terbaca | Lihat catatan di akhir bagian E pada `docs/SHORTCUT.md` |
| `Terjadi kesalahan di skrip: …` | Error di skrip, misalnya nama tab diubah | Pastikan tab bernama persis `Transaksi` dan `Kategori` |
| Back Tap tidak bereaksi | Pengaturan Back Tap atau casing | Cek ulang pengaturan Back Tap; coba jalankan dari app Shortcuts |

Jangan mengganti nama tab atau urutan kolom di tab Transaksi dan Kategori, karena skrip membacanya berdasarkan nama tab dan posisi kolom.

## Isi repositori

| Path | Isi |
|---|---|
| `apps-script/` | Kode yang ditempel ke Apps Script |
| `tests/` | Unit test (`npm test`, butuh Node 20+) |
| `docs/SETUP.md` | Pasang dan deploy skrip |
| `docs/SHORTCUT.md` | Rakit Shortcut, Back Tap, dan uji |
| `docs/superpowers/specs/` | Spesifikasi dan diagram alur |
| `docs/superpowers/plans/` | Rencana implementasi |
