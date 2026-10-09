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
4. **Get Dictionary from Input** (Dapatkan Kamus dari Input) → **Set Variable** `Kategori`.
5. **Get Dictionary Value** (Dapatkan Nilai Kamus) → kunci `menuPengeluaran` dari `Kategori`.
6. **If** (Jika) → *Dictionary Value* **does not have any value** (tidak memiliki nilai). Cache belum ada atau rusak, jadi ambil dari skrip:
   - **Get Contents of URL** (Dapatkan Isi URL): URL = `Konfigurasi` → `url`. Metode **POST**, Request Body **JSON**:
     - `aksi` (Teks) = `kategori`
     - `kunci` (Teks) = `Konfigurasi` → `kunci`
   - **Get Dictionary from Input** → **Set Variable** `Kategori`.
   - **Get Dictionary Value** `menuPengeluaran` dari `Kategori`.
   - **If** *Dictionary Value* **has any value** → **Save File** (Simpan File) dengan input `Kategori`: matikan **Ask Where to Save**, Subpath `catat-kategori.json`, nyalakan **Overwrite If File Exists** → **End If**.
   - **End If**.
7. **Get Dictionary Value** `menuPengeluaran` dari `Kategori`.
8. **If** *Dictionary Value* **does not have any value**:
   - **Get Dictionary Value** `pesan` dari `Kategori` → **Show Notification** (Tampilkan Pemberitahuan) dengan isi tersebut. Biasanya isinya `Kunci salah`.
   - **Stop This Shortcut** (Hentikan Pintasan Ini).
   - **End If**.
9. **Get Dictionary Value** `menuPengeluaran` dari `Kategori` → **Choose from List** (Pilih dari Daftar), Prompt `Untuk apa?`.
10. **If** *Chosen Item* **is** `💰 Pemasukan…` (salin persis dari menu, termasuk elipsisnya):
    - **Text** `Pemasukan` → **Set Variable** `Jenis`.
    - **Get Dictionary Value** `menuPemasukan` dari `Kategori` → **Choose from List** (Prompt `Pemasukan apa?`) → **Set Variable** `Pilihan`.
    - **Otherwise** (Jika Tidak):
    - **Text** `Pengeluaran` → **Set Variable** `Jenis`.
    - **Set Variable** `Pilihan` = *Chosen Item* dari langkah 9.
    - **End If**.

### C. Isi transaksi

11. **Ask for Input** (Minta Input) → tipe **Number**, Prompt `Berapa?`, matikan **Allow Decimal Numbers** → **Set Variable** `Nominal`.
12. **Ask for Input** → tipe **Text**, Prompt `Catatan? (boleh kosong)` → **Set Variable** `Catatan`.
13. **Format Date** (Format Tanggal) → *Current Date*, Date Format **Custom**, pola `yyyyMMddHHmmssSSS`.
14. **Random Number** (Angka Acak) → min `1000`, max `9999`.
15. **Text** → `[Formatted Date]-[Random Number]` → **Set Variable** `ID`.
16. **Format Date** → *Current Date*, Date Format **ISO 8601**, nyalakan **Include ISO 8601 Time** → **Set Variable** `Waktu`.
17. **Dictionary** → **Set Variable** `Transaksi`, dengan item:

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

18. **Get File** → Shortcuts / `catat-antrian.json`, matikan **Error If Not Found**.
19. **Get Dictionary from Input** → **Get Dictionary Value** kunci `antrian`.
20. **Repeat with Each** (Ulangi dengan Setiap) → di dalamnya **Add to Variable** (Tambahkan ke Variabel) `Antrian` = *Repeat Item* → **End Repeat**.
21. **Add to Variable** `Antrian` = `Transaksi`.
22. **Dictionary** (kosong) → **Set Dictionary Value** (Atur Nilai Kamus): kunci `antrian`, nilai = variabel `Antrian`.
23. **Save File** → Subpath `catat-antrian.json`, Overwrite **nyala**, Ask Where to Save **mati**.

### E. Kirim antrian

Item yang **gagal sementara** (balasan kosong atau diawali "Coba lagi") disimpan untuk run berikutnya. Item lain dibuang setelah notifikasinya tampil, termasuk yang ditolak (misalnya `Kunci salah`), karena mengirimnya ulang tidak akan berhasil.

24. **Repeat with Each** item di `Antrian`:
    - **Get Contents of URL**: URL = `Konfigurasi` → `url`, Metode **POST**, Request Body **File** = *Repeat Item*, header `Content-Type` = `application/json`.
    - **Get Dictionary Value** `pesan` dari *Contents of URL* → **Set Variable** `Pesan`.
    - **If** `Pesan` **has any value**:
      - **If** `Pesan` **begins with** `Coba lagi` → **Add to Variable** `Tersisa` = *Repeat Item* → **End If**.
      - **Show Notification** → isi `Pesan`, judul `Catat`.
    - **Otherwise**:
      - **Add to Variable** `Tersisa` = *Repeat Item*.
      - **Show Notification** → `Skrip tidak membalas dengan benar. Transaksi disimpan dan dikirim ulang nanti.`
    - **End If**.
    - **End Repeat**.
25. **Dictionary** (kosong) → **Set Dictionary Value**: kunci `antrian`, nilai = variabel `Tersisa`.
26. **Save File** → Subpath `catat-antrian.json`, Overwrite **nyala**.

### F. Segarkan cache kategori

27. **Get Contents of URL** → sama seperti di langkah 6 (`aksi` = `kategori`).
28. **Get Dictionary from Input** → **Get Dictionary Value** `menuPengeluaran`.
29. **If** *Dictionary Value* **has any value** → **Save File** dengan input *Dictionary* dari langkah 28 (bukan nilai `menuPengeluaran`): Subpath `catat-kategori.json`, Overwrite **nyala** → **End If**.

Selesai. Tekan **Done**.

> **Kalau notifikasinya berbunyi "Permintaan tidak valid"**, berarti iOS tidak mengirim Repeat Item sebagai JSON. Di langkah 24, ganti Request Body menjadi **JSON** dan isi 8 field yang sama seperti tabel langkah 17. Ambil nilai tiap field lewat **Get Dictionary Value** dari *Repeat Item*.

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
- [ ] **2. Offline.** Nyalakan mode pesawat → catat 10000. Hasil: error jaringan dari iOS. Buka app **File** → iCloud Drive → Shortcuts → `catat-antrian.json`. Isinya harus berbentuk `{"antrian":[{"aksi":"catat",…}]}`. Kalau berbentuk `{"antrian":[[…]]}` (dua kurung siku), langkah 22 menyimpan daftar bersarang; jangan pakai antrian sebelum ini diperbaiki. Matikan mode pesawat → catat 5000. Hasil: dua notifikasi (10.000 dan 5.000), dua baris baru, tanpa duplikat.
- [ ] **3. Kunci salah.** Ubah satu huruf `kunci` di langkah 1 → catat. Hasil: notifikasi `Kunci salah`, tidak ada baris baru. Kembalikan kuncinya → catat lagi. Hasil: berjalan normal (menu tidak ikut rusak).
- [ ] **4. Kategori nonaktif.** Di tab Kategori, hapus centang Aktif pada 🎬 Hiburan → catat apa saja satu kali → catat lagi. Hasil: pada catatan kedua, Hiburan tidak ada di menu.
- [ ] **5. Kecepatan.** Dengan Back Tap, dari ketuk sampai notifikasi ≤ 5 detik (tidak termasuk waktu Anda mengetik).

Setelah selesai, hapus baris-baris uji di tab Transaksi.
