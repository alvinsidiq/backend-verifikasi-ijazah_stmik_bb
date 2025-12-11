# Backend Verifikasi Ijazah Berbasis Blockchain

API backend untuk verifikasi ijazah yang menyimpan hash ijazah ke blockchain (dummy) dan menyediakan endpoint publik untuk pengecekan hash.

## Konvensi Umum
- Base URL (dev lokal): `http://localhost:3000`
- Format request/response: JSON
- Autentikasi: JWT Bearer Token (`Authorization: Bearer <token>`)
- Struktur response standar:
```json
{
  "success": true,
  "message": "Pesan (opsional)",
  "data": {}
}
```
- Role user (`Role` enum): `ADMIN`, `VALIDATOR`, `MAHASISWA`

---

## 1. Auth

### 1.1 Login
- Endpoint: `POST /auth/login`
- Akses: Public
- Body:
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```
- Response (200):
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "token": "JWT_TOKEN_DI_SINI",
    "user": {
      "id": 1,
      "name": "Admin",
      "email": "admin@example.com",
      "role": "ADMIN"
    }
  }
}
```

### 1.2 Register User (oleh ADMIN)
- Endpoint: `POST /auth/register`
- Akses: `ADMIN`
- Header:
```
Authorization: Bearer <token_admin>
Content-Type: application/json
```
- Body:
```json
{
  "name": "Pak Validator",
  "email": "validator@example.com",
  "password": "validator123",
  "role": "VALIDATOR"
}
```
- Catatan: `role` opsional → default `MAHASISWA`.

### 1.3 Get Profile dari Token
- Endpoint: `GET /auth/me`
- Akses: Semua user login
- Header: `Authorization: Bearer <token>`
- Response (200):
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "email": "admin@example.com",
    "name": "Admin",
    "role": "ADMIN"
  }
}
```

---

## 2. Program Studi
- Model: `id`, `kodeProdi` (unik), `namaProdi`, `jenjang`.

### 2.1 List Program Studi
- Endpoint: `GET /program-studi`
- Akses: Semua user login
- Response contoh:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "kodeProdi": "TI-S1",
      "namaProdi": "Teknik Informatika",
      "jenjang": "S1"
    }
  ]
}
```

### 2.2 Detail Program Studi
- Endpoint: `GET /program-studi/:id`
- Akses: Semua user login

### 2.3 Create Program Studi
- Endpoint: `POST /program-studi`
- Akses: `ADMIN`
- Body:
```json
{
  "kodeProdi": "TI-S1",
  "namaProdi": "Teknik Informatika",
  "jenjang": "S1"
}
```

### 2.4 Update Program Studi
- Endpoint: `PUT /program-studi/:id`
- Akses: `ADMIN`
- Body (opsional):
```json
{
  "kodeProdi": "TI-S1",
  "namaProdi": "Teknik Informatika (Update)",
  "jenjang": "S1"
}
```

### 2.5 Delete Program Studi
- Endpoint: `DELETE /program-studi/:id`
- Akses: `ADMIN`

---

## 3. Mahasiswa
- Relasi: `Mahasiswa` → `User` (role `MAHASISWA`), `Mahasiswa` → `ProgramStudi`.
- Field utama: `userId`, `nim`, `nama`, `prodiId`, `tahunMasuk`, `tahunLulus?`, `tempatLahir?`, `tanggalLahir?`.

### 3.1 List Mahasiswa
- Endpoint: `GET /mahasiswa`
- Akses: `ADMIN`, `VALIDATOR`

### 3.2 Detail Mahasiswa
- Endpoint: `GET /mahasiswa/:id`
- Akses: `ADMIN`, `VALIDATOR`

### 3.3 Create Mahasiswa
- Endpoint: `POST /mahasiswa`
- Akses: `ADMIN`
- Body:
```json
{
  "userId": 3,
  "nim": "201801234",
  "nama": "Mahasiswa 1",
  "prodiId": 1,
  "tahunMasuk": 2018,
  "tahunLulus": 2022,
  "tempatLahir": "Denpasar",
  "tanggalLahir": "2000-05-10"
}
```

### 3.4 Update Mahasiswa
- Endpoint: `PUT /mahasiswa/:id`
- Akses: `ADMIN`
- Body (opsional):
```json
{
  "nim": "201801234",
  "nama": "Mahasiswa 1 Update",
  "prodiId": 2,
  "tahunMasuk": 2019,
  "tahunLulus": 2023,
  "tempatLahir": "Jimbaran",
  "tanggalLahir": "2000-05-12"
}
```

### 3.5 Delete Mahasiswa
- Endpoint: `DELETE /mahasiswa/:id`
- Akses: `ADMIN`

### 3.6 Mahasiswa Lihat Datanya Sendiri
- Endpoint: `GET /mahasiswa/me`
- Akses: `MAHASISWA`

---

## 4. Ijazah
- Enum `StatusValidasi`: `DRAFT`, `MENUNGGU`, `TERVALIDASI`, `DITOLAK`.
- Field utama: `mahasiswaId`, `nomorIjazah` (unik), `tanggalLulus`, `fileUrl?`, `statusValidasi`, `validatorId?`, `catatanValidasi?`, `validatedAt?`.

### 4.1 List Ijazah (Internal)
- Endpoint: `GET /ijazah`
- Akses: `ADMIN`, `VALIDATOR`
- Query opsional: `status` (`DRAFT`, `MENUNGGU`, `TERVALIDASI`, `DITOLAK`), `nim`.

### 4.2 Detail Ijazah
- Endpoint: `GET /ijazah/:id`
- Akses: `ADMIN`, `VALIDATOR`

### 4.3 Create Ijazah (status awal: DRAFT)
- Endpoint: `POST /ijazah`
- Akses: `ADMIN`
- Body:
```json
{
  "mahasiswaId": 1,
  "nomorIjazah": "IJZ/TI/2022/001",
  "tanggalLulus": "2022-08-15",
  "fileUrl": "/uploads/ijazah/IJZ-TI-2022-001.pdf"
}
```

### 4.4 Update Ijazah
- Endpoint: `PUT /ijazah/:id`
- Akses: `ADMIN`
- Body (opsional):
```json
{
  "nomorIjazah": "IJZ/TI/2022/001-REV",
  "tanggalLulus": "2022-09-01",
  "fileUrl": "/uploads/ijazah/baru.pdf"
}
```

### 4.5 Kirim Ijazah untuk Validasi
- Endpoint: `POST /ijazah/:id/kirim-validasi`
- Akses: `ADMIN`
- Flow: hanya dari `DRAFT`/`DITOLAK` → `MENUNGGU`.

### 4.6 Validasi Ijazah (Setuju / Tolak)
- Endpoint: `POST /ijazah/:id/validasi`
- Akses: `VALIDATOR`, `ADMIN`
- Body:
```json
{
  "status": "TERVALIDASI",
  "catatan": "Data sudah sesuai"
}
```
- Hanya jika status saat ini `MENUNGGU`. `status` harus `TERVALIDASI` atau `DITOLAK`.

### 4.7 Mahasiswa Lihat Ijazah Miliknya
- Endpoint: `GET /ijazah/me`
- Akses: `MAHASISWA`

---

## 5. Blockchain Record & Mint (Dummy)
- Model `BlockchainRecord`: `ijazahId` (unik), `ijazahHash`, `contractAddress?`, `network`, `txHash?`, `blockNumber?`, `statusOnchain`, `explorerUrl?`.
- Enum `StatusOnchain`: `DUMMY`, `PENDING`, `SUCCESS`, `FAILED`.

### 5.1 Dummy Mint Ijazah ke "Blockchain"
- Endpoint: `POST /ijazah/:id/mint`
- Akses: `VALIDATOR`, `ADMIN`
- Syarat: `Ijazah.statusValidasi = TERVALIDASI` dan belum punya `BlockchainRecord`.
- Response contoh:
```json
{
  "success": true,
  "message": "Ijazah berhasil di-mint (dummy) ke blockchain",
  "data": {
    "ijazahId": 1,
    "ijazahHash": "0x8f3a2d3c...",
    "txHash": "0xDUMMYTX_1_196e4a723f0",
    "contractAddress": "0xDUMMYCONTRACT_1",
    "network": "polygon-mumbai",
    "blockNumber": 0,
    "statusOnchain": "DUMMY",
    "explorerUrl": "https://dummy-explorer/polygon-mumbai/tx/0xDUMMYTX_1_196e4a723f0"
  }
}
```
- Catatan: hanya `ijazahHash` yang diperlakukan on-chain, bukan file ijazah.

---

## 6. Verifikasi Publik (Tanpa Login)
- Model `VerificationLog`: `ijazahId`, `verifierType`, `verifierInfo?`, `verifiedAt`.
- Enum `VerifierType`: `MAHASISWA`, `PERUSAHAAN`, `ADMIN`, `SYSTEM`.

### 6.1 Verifikasi Ijazah Berdasarkan Hash
- Endpoint: `GET /verifikasi?hash=0x...`
- Akses: Public
- Query:
  - `hash` (wajib) → `ijazahHash` dari `BlockchainRecord`
  - `verifierType` (opsional) → `MAHASISWA` | `PERUSAHAAN` | `ADMIN` | `SYSTEM`
  - `verifierInfo` (opsional) → teks tambahan (misal nama perusahaan)
- Contoh:
```
GET /verifikasi?hash=0x8f3a2d3c...
GET /verifikasi?hash=0x8f3a2d3c...&verifierType=PERUSAHAAN&verifierInfo=PT%20Maju%20Jaya
```
- Response (200):
```json
{
  "success": true,
  "data": {
    "valid": true,
    "ijazah": {
      "id": 1,
      "nomorIjazah": "IJZ/TI/2022/001",
      "tanggalLulus": "2022-08-15T00:00:00.000Z",
      "statusValidasi": "TERVALIDASI",
      "catatanValidasi": "Data sudah sesuai"
    },
    "mahasiswa": {
      "id": 1,
      "nim": "201801234",
      "nama": "Mahasiswa 1",
      "prodi": {
        "kodeProdi": "TI-S1",
        "namaProdi": "Teknik Informatika",
        "jenjang": "S1"
      }
    },
    "blockchain": {
      "ijazahHash": "0x8f3a2d3c...",
      "network": "polygon-mumbai",
      "txHash": "0xDUMMYTX_1_196e4a723f0",
      "contractAddress": "0xDUMMYCONTRACT_1",
      "blockNumber": 0,
      "statusOnchain": "DUMMY",
      "explorerUrl": "https://dummy-explorer/polygon-mumbai/tx/0xDUMMYTX_1_196e4a723f0"
    }
  }
}
```
- Setiap pemanggilan endpoint ini akan menambahkan 1 baris ke tabel `VerificationLog`.

---

## Catatan Tambahan
- Jalankan aplikasi via `npm start`.
- Prisma schema berada di `prisma/schema.prisma`. Setelah mengubah schema, jalankan migrasi (`npx prisma migrate dev`) di lingkungan interaktif atau gunakan `prisma migrate deploy` untuk menerapkan migrasi yang sudah ada.
