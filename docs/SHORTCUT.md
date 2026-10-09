# Merakit Shortcut "Catat"

Waktu: sekitar 20 menit, di iPhone. Butuh **URL web app** dan **kunci** dari `SETUP.md`.

Nama aksi ditulis dalam bahasa Inggris, karena nama itulah yang paling pasti ditemukan lewat kolom pencarian aksi. Di iPhone berbahasa Indonesia, cari dengan kata kunci di dalam kurung.

Semua file Shortcut ini disimpan di **iCloud Drive → Shortcuts**:
- `catat-antrian.json`: transaksi yang belum terkirim.
- `catat-kategori.json`: cache menu kategori.

## Prinsip

Setiap transaksi **ditulis ke antrian dulu, baru dikirim**. Kalau internet putus, iOS menampilkan error dan Shortcut berhenti, tetapi transaksinya sudah aman di antrian. Antrian dikirim ulang pada run berikutnya. Skrip mengenali ID yang sama, jadi tidak ada baris ganda.

## Langkah perakitan

Buka app **Shortcuts** → **+** → ganti nama shortcut menjadi **Catat** (nama harus persis). Lalu tambahkan aksi berikut secara berurutan.

### A. Konfigurasi

1. **Dictionary** (Kamus). Tambah dua item Teks:
   - `url` = URL web app (diakhiri `/exec`)
   - `kunci` = kunci 32 karakter
2. **Set Variable** (Atur Variabel) → nama `Konfigurasi`.

### B. Menu kategori dari cache

3. **Get File** (Dapatkan File) → Shortcuts / `catat-kategori.json`. Matikan **Error If Not Found**.
4. **If** (Jika) → *File* **does not have any value** (tidak memiliki nilai):
   - **Get Contents of URL** (Dapatkan Isi URL): URL = `Konfigurasi` → `url`. Metode **POST**, Request Body **JSON**:
     - `aksi` (Teks) = `kategori`
     - `kunci` (Teks) = `Konfigurasi` → `kunci`
   - **Save File** (Simpan File): matikan **Ask Where to Save**, Subpath `catat-kategori.json`, nyalakan **Overwrite If File Exists**.
   - **End If**.
5. **Get File** → Shortcuts / `catat-kategori.json` (ambil ulang setelah langkah 4).
6. **Get Dictionary from Input** (Dapatkan Kamus dari Input) → **Set Variable** `Kategori`.
7. **Get Dictionary Value** (Dapatkan Nilai Kamus) → kunci `menuPengeluaran` dari `Kategori`.
8. **Choose from List** (Pilih dari Daftar) → Prompt `Untuk apa?`.
9. **If** *Chosen Item* **is** `💰 Pemasukan…` (salin teks ini persis dari daftar kategori, termasuk elipsisnya):
   - **Text** `Pemasukan` → **Set Variable** `Jenis`.
   - **Get Dictionary Value** `menuPemasukan` dari `Kategori` → **Choose from List** (Prompt `Pemasukan apa?`) → **Set Variable** `Pilihan`.
   - **Otherwise** (Jika Tidak):
   - **Text** `Pengeluaran` → **Set Variable** `Jenis`.
   - **Set Variable** `Pilihan` = *Chosen Item* dari langkah 8.
   - **End If**.

### C. Isi transaksi

10. **Ask for Input** (Minta Input) → tipe **Number**, Prompt `Berapa?`, matikan **Allow Decimal Numbers** → **Set Variable** `Nominal`.
11. **Ask for Input** → tipe **Text**, Prompt `Catatan? (boleh kosong)` → **Set Variable** `Catatan`.
12. **Format Date** (Format Tanggal) → *Current Date*, Date Format **Custom**, pola `yyyyMMddHHmmssSSS`.
13. **Random Number** (Angka Acak) → min `1000`, max `9999`.
14. **Text** → `[Formatted Date]-[Random Number]` → **Set Variable** `ID`.
15. **Format Date** → *Current Date*, Date Format **ISO 8601**, nyalakan **Include ISO 8601 Time** → **Set Variable** `Waktu`.
16. **Dictionary** → **Set Variable** `Transaksi`, dengan item:

   | Kunci | Tipe | Nilai |
   |---|---|---|
   | `aksi` | Teks | `catat` |
   | `kunci` | Teks | `Konfigurasi` → `kunci` |
   | `id` | Teks | `ID` |
   | `jenis` | Teks | `Jenis` |
   | `kategori` | Teks | `Pilihan` |
   | `nominal` | Angka | `Nominal` |
   | `catatan` | Teks | `Catatan` |
   | `waktu` | Teks | `Waktu` |

### D. Tulis ke antrian

17. **Get File** → Shortcuts / `catat-antrian.json`, matikan **Error If Not Found**.
18. **Get Dictionary from Input** → **Get Dictionary Value** kunci `antrian`.
19. **Repeat with Each** (Ulangi dengan Setiap) → di dalamnya **Add to Variable** (Tambahkan ke Variabel) `Antrian` = *Repeat Item* → **End Repeat**.
20. **Add to Variable** `Antrian` = `Transaksi`.
21. **Dictionary** dengan satu item `antrian` (tipe **Array**) berisi variabel `Antrian`.
22. **Save File** → Subpath `catat-antrian.json`, Overwrite **nyala**, Ask Where to Save **mati**.

### E. Kirim antrian

23. **Repeat with Each** item di `Antrian`:
    - **Get Contents of URL**: URL = `Konfigurasi` → `url`, Metode **POST**, Request Body **File** = *Repeat Item*, header `Content-Type` = `application/json`.
    - **Get Dictionary Value** `pesan` dari *Contents of URL*.
    - **Show Notification** (Tampilkan Pemberitahuan) → isi = *Dictionary Value*, judul `Catat`.
    - **End Repeat**.
24. **Text** → `{"antrian":[]}`.
25. **Save File** → Subpath `catat-antrian.json`, Overwrite **nyala**.

### F. Segarkan cache kategori

26. **Get Contents of URL** → sama seperti langkah 4 (`aksi` = `kategori`).
27. **Save File** → Subpath `catat-kategori.json`, Overwrite **nyala**.

Selesai. Tekan **Done**.

> **Kalau notifikasinya berbunyi "Permintaan tidak valid"**, berarti iOS tidak mengirim Repeat Item sebagai JSON. Di langkah 23, ganti Request Body menjadi **JSON** dan isi 8 field yang sama seperti tabel langkah 16. Ambil nilai tiap field lewat **Get Dictionary Value** dari *Repeat Item*.

## Izin pertama kali

Jalankan **Catat** sekali dari app Shortcuts. Saat diminta:
- akses ke `script.google.com` → **Always Allow / Selalu Izinkan**
- akses file iCloud Drive → **Always Allow / Selalu Izinkan**
- notifikasi untuk Shortcuts → **Izinkan**

## Pasang Back Tap

**Pengaturan → Aksesibilitas → Sentuh → Ketuk Bagian Belakang → Ketuk Dua Kali → Catat** (gulir ke bagian Pintasan).

Back Tap bekerja di iPhone 8 ke atas. Casing yang sangat tebal bisa membuatnya kurang peka.

## Uji ujung ke ujung

Centang setelah hasilnya sesuai.

- [ ] **1. Online.** Ketuk dua kali → pilih 🍜 Makan & Minum → 25000 → catatan `tes`. Hasil yang diharapkan: notifikasi `Tersimpan Rp25.000 · 🍜 Makan & Minum` + baris "Bulan ini", baris baru di tab Transaksi dengan Sumber `Shortcut`, dan tab Ringkasan ikut berubah.
- [ ] **2. Offline.** Nyalakan mode pesawat → catat 10000. Hasil: error jaringan dari iOS. Matikan mode pesawat → catat 5000. Hasil: dua notifikasi (10.000 dan 5.000), dua baris baru, tanpa duplikat.
- [ ] **3. Kunci salah.** Ubah satu huruf `kunci` di langkah 1 → catat. Hasil: notifikasi `Kunci salah`, tidak ada baris baru. Kembalikan kuncinya.
- [ ] **4. Kategori nonaktif.** Di tab Kategori, hapus centang Aktif pada 🎬 Hiburan → catat apa saja satu kali → catat lagi. Hasil: pada catatan kedua, Hiburan tidak ada di menu.
- [ ] **5. Kecepatan.** Dengan Back Tap, dari ketuk sampai notifikasi ≤ 5 detik (tidak termasuk waktu Anda mengetik).

Setelah selesai, hapus baris-baris uji di tab Transaksi.
