# Setup skrip Apps Script

Sekali saja, sekitar 10 menit, dari laptop. Hasilnya: **URL web app** dan **kunci** untuk Shortcut.

## 1. Buka editor skrip

1. Buka spreadsheet **Keuangan — Back Tap**.
2. Menu **Ekstensi → Apps Script**. Editor terbuka di tab baru.
3. Ganti nama proyek (kiri atas, "Proyek tanpa judul") menjadi `Catat Back Tap`.

## 2. Tempel kode

Di editor sudah ada file `Kode.gs`. Buat empat file lagi dengan tombol **+** → **Skrip**, lalu beri nama persis seperti ini (akhiran `.gs` ditambahkan otomatis):

| Nama file di editor | Isi dari |
|---|---|
| `Nominal` | `apps-script/Nominal.js` |
| `Ringkasan` | `apps-script/Ringkasan.js` |
| `Validasi` | `apps-script/Validasi.js` |
| `Aksi` | `apps-script/Aksi.js` |
| `Kode` (sudah ada) | `apps-script/Kode.js` (hapus isi bawaannya dulu) |

Lalu manifest:

1. Klik ikon roda gigi **Setelan proyek** di kiri.
2. Centang **Tampilkan file manifes "appsscript.json" di editor**.
3. Kembali ke **Editor**, buka `appsscript.json`, ganti seluruh isinya dengan `apps-script/appsscript.json`.
4. Tekan **Simpan** (ikon disket atau Cmd+S).

## 3. Buat kunci

1. Di toolbar atas, pilih fungsi **buatKunci**, lalu klik **Jalankan**.
2. Pertama kali, Google meminta izin. Pilih akun Anda → **Lanjutan** → **Buka Catat Back Tap (tidak aman)** → **Izinkan**. Peringatan "tidak aman" muncul karena skrip ini buatan Anda sendiri dan belum diverifikasi Google.
3. Buka **Log eksekusi** di bawah. Salin teks setelah `Kunci baru:` (32 karakter). Simpan di Notes atau password manager; kunci ini dimasukkan ke Shortcut.

Menjalankan `buatKunci` lagi akan **mengganti** kunci lama. Shortcut harus diisi ulang dengan kunci baru.

## 4. Uji dari editor

1. Pilih fungsi **tesCatat** → **Jalankan**.
2. Log harus berisi `"ok":true` dan teks seperti `Tersimpan Rp1.000 · 📦 Lainnya`.
3. Tab Transaksi tetap kosong, karena baris tes langsung dihapus.

Kalau log berisi `Kunci belum diatur`, ulangi langkah 3.

## 5. Deploy sebagai web app

1. Kanan atas: **Terapkan → Deployment baru**.
2. Ikon roda gigi di samping "Pilih jenis" → **Aplikasi web**.
3. Isi:
   - Deskripsi: `v1`
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
4. **Terapkan**, lalu salin **URL aplikasi web** (diakhiri `/exec`).

"Siapa saja" diperlukan karena Shortcut tidak bisa login Google. Tanpa kunci yang benar, skrip hanya membalas `Kunci salah` dan tidak membaca atau menulis apa pun.

## 6. Uji dari Terminal Mac (opsional, disarankan)

Ganti `URL` dan `KUNCI`:

```bash
curl -sL -H 'Content-Type: application/json' \
  -d '{"aksi":"kategori","kunci":"KUNCI"}' 'URL'
```

Hasil yang benar: JSON berisi `"ok":true` dan daftar kategori. Dengan kunci asal-asalan, hasilnya `{"ok":false,"pesan":"Kunci salah"}`.

## Setelah mengubah kode

**Terapkan → Kelola deployment** → ikon pensil → Versi: **Versi baru** → **Terapkan**. URL tetap sama, Shortcut tidak perlu diubah. Membuat "Deployment baru" justru menghasilkan URL baru.
