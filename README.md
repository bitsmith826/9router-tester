# ⚡ 9Router Companion CLI
### *The Ultimate All-in-One CLI for 9Router: Health Doctor, Combo Architect & Rate-Limit Stress Tester*
*(Also compatible with One API, New API, LiteLLM, OpenRouter, Ollama & vLLM)*

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![9Router Compatible](https://img.shields.io/badge/9Router-Compatible-FF6B6B)](https://github.com/decolua/9router)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI--API-Compatible-412991)](https://platform.openai.com/)

> **All-in-One CLI companion for 9Router (also compatible with One API, New API, LiteLLM, OpenRouter, Ollama, vLLM).**
> 
> *Deteksi model hidup/mati dalam 3 detik untuk Cursor, racik paket Combo fallback 3-tier otomatis, dan uji batas ketahanan rate-limit (RPM/TPM) provider AI Anda.*

---

## ⚡ 30-Second Quickstart (Khusus Pengguna 9Router di Laptop)

Jika Anda menjalankan **9Router di laptop Anda (`localhost:20128`)**, Anda bisa langsung menguji batas limit provider dalam hitungan detik tanpa perlu mengubah file konfigurasi apa pun:

```bash
# 1. Clone repositori ini
git clone https://github.com/bitsmith826/9router-stress-test.git
cd 9router-stress-test

# 2. Install dependensi & build
npm install
npm run build

# 3. Jalankan wizard interaktif
npm start
```

### 🖥️ Simulasi Tampilan di Terminal Anda:

```text
╔═══════════════════════════════════════════════════════════╗
║                 9ROUTER COMPANION CLI                     ║
║     Health Doctor • Combo Architect • Stress Tester       ║
╚═══════════════════════════════════════════════════════════╝

? AI Router Endpoint URL: http://localhost:20128/v1   <-- [Tekan Enter]
? API Key (kosongkan jika tidak perlu): 9router       <-- [Tekan Enter]
✔ Berhasil menemukan 12 model aktif dari 9Router!

? Pilih Target AI Model yang ingin diuji:
  > 💡 [RECOMMEND 9ROUTER COMBOS] Scan & Racik Paket Combo Fallback Otomatis
    🩺 [QUICK HEALTH SCAN] Pindai Cepat Model Hidup & Mati (3-5 Detik Selesai)
    💥 [DEEP STRESS TEST] Uji Limit & Throughput Semua Model (12 Model)
    🤖 claude-3-5-sonnet
    🤖 deepseek-chat
    ✏️  [Ketik nama model kustom secara manual...]
```

---

## 🌟 Key Features / Fitur Utama

- 💡 **9Router Smart Combo Doctor & Recommender:** Mengatasi kebingungan saat membuat **Model Combo** di 9Router karena terlalu banyak pilihan model. Fitur ini otomatis:
  - Mengklasifikasikan model ke dalam 4 spesialisasi: 💻 *Coding Pro*, ⚡ *Speed & Autocomplete*, 🧠 *Deep Reasoning*, 💰 *Budget Saver*.
  - Menguji model aktif dan menyusun rantai fallback 3-tier (`Tier 1 Primary` $\rightarrow$ `Tier 2 Fallback` $\rightarrow$ `Tier 3 Emergency`).
  - Menyediakan **blok teks copy-paste instan** (Nama Combo dan urutan model) yang bisa langsung disalin ke formulir pembuatan Combo 9Router!
  - Menyediakan menu filter kategori interaktif di CLI agar Anda bisa menyaring model dengan mudah.
- 🩺 **Quick Health Scan (3-5 Detik Selesai):** Pindai paralel status hidup/mati seluruh model di 9Router dengan 1 kali probe cepat. Otomatis menghasilkan daftar model aktif siap pakai untuk Cursor/Cline serta peringatan model mati.
- 🔥 **Batch Health & Stress Test (All-Models at Once):** Tidak perlu menguji model satu per satu! Cukup pilih opsi *[UJI SEMUA MODEL SEKALIGUS]* atau pasang flag `-a, --all-models`. Tool otomatis mengecek seluruh model aktif di router Anda, memberi tanda mana yang **✔ ACTIVE (200)**, mana yang **⚡ FALLBACK**, mana yang **🚨 RATE LIMITED (429)**, dan mana yang **✖ DEAD/ERROR**.
- 🔍 **Dynamic Model Discovery (`/v1/models`):** Otomatis menghubungi endpoint router Anda untuk mengambil daftar model aktif yang tersedia dan menampilkannya sebagai pilihan di terminal. Juga menyediakan daftar preset model AI terpopuler (Claude 3.5, GPT-4o, Gemini 2.0, DeepSeek, Llama 3, Qwen) serta opsi ketik manual.
- 🌐 **Universal Gateway Support:** Dirancang untuk bekerja dengan semua proxy OpenAI-compatible: **9Router**, **One API**, **New API**, **LiteLLM**, **OpenRouter**, **Portkey**, **Ollama**, **vLLM**, atau endpoint mandiri.
- 💥 **Aggressive Burst Engine:** Kirim lonjakan request serentak dalam hitungan milidetik untuk menguji ketahanan gateway dan mendeteksi titik rate-limit provider seketika.
- 🛡️ **Universal Smart Fallback Detection:** Otomatis mendeteksi saat provider utama limit dan router mengalihkan request ke model lapis kedua (misal: Claude $\rightarrow$ DeepSeek/Gemini) lewat inspeksi model respon dan header gateway.
- 💰 **Dual Testing Modes & Token Telemetry:**
  - **`--mode rpm` (Hemat Token):** Menggunakan prompt 1 kata (`ping`) dan `max_tokens: 5`. Menghantam batas panggilan per menit (RPM) tanpa membakar kuota/biaya API.
  - **`--mode tpm` & `--max-tokens <n>` (Beban Token Maksimum):** Mengirim payload arsitektur mendalam dan meminta ribuan token output (default: 1.000 token, bisa dinaikkan ke 2.000, 4.000, atau 8.000 token) untuk menabrak batas kuota *Tokens-Per-Minute* (TPM) provider. Dilengkapi pelacak **Total Tokens Used**, **Token Split (In/Out)**, dan **Token Speed (`tok/s` & `~TPM`)** langsung di tabel terminal!
- 🧙 **Interactive CLI Wizard:** Cukup jalankan `npm start`, dan wizard interaktif (tanya-jawab) akan memandu Anda menentukan URL, memilih Model dari daftar, mengatur mode RPM/TPM, dan jumlah token.
- ⏱️ **Comprehensive Metrics:** Menghitung Throughput (RPS), status code breakdown, serta tabel persentil latensi lengkap (`p50`, `p90`, `p95`, `p99`, `Min`, `Max`, `Avg`).
- 📁 **JSON Export:** Simpan hasil pengujian lengkap ke file JSON untuk audit atau benchmarking performa berkala.

---

## 🚀 Quick Start / Cara Memulai

### 1. Prasyarat
- [Node.js](https://nodejs.org/) v18.0.0 atau lebih baru.
- Instance AI Router yang sedang aktif (9Router, One API, LiteLLM, Ollama, VPS, atau Cloudflare Tunnel).

### 2. Instalasi

```bash
# Clone repositori
git clone https://github.com/bitsmith826/9router-stress-test.git
cd 9router-stress-test

# Install dependencies
npm install

# Compile TypeScript
npm run build
```

---

## 💻 Panduan Penggunaan Cepat (Quick Usage)

### 1. Wizard Interaktif (Tanya-Jawab Ramah Pemula)
Cukup jalankan tanpa argumen:
```bash
npm start
```
Wizard terminal akan memandu Anda mendeteksi model, memilih mode, dan menjalankan diagnostik.

---

### 2. Shorthand Flags (Perintah Cepat Sekali Ketik)

```bash
# 🩺 1. Cek Model Hidup / Mati untuk Cursor (Doctor Mode - 3 Detik)
node dist/index.js --doctor

# 💡 2. Racik 4 Rekomendasi Combo Fallback 9Router Siap Copy-Paste
node dist/index.js --combos

# 💥 3. Deep Stress Test Limit Seluruh Model Sekaligus
node dist/index.js --stress

# ⚡ 4. Ultra TPM Mode: Stress Test Beban Token Masif (misal 2.000 token/req)
node dist/index.js --model claude-3-5-sonnet --mode tpm --max-tokens 2000 --burst 10 --concurrency 5

# 🌐 5. Uji Endpoint VPS / Cloudflare Tunnel
node dist/index.js --url https://ai.domainanda.com/v1 --key RahasiaAnda123! --doctor
```

---

## ⚙️ CLI Options & Flags

| Flag | Default | Deskripsi |
|---|---|---|
| `-d, --doctor` | `false` | **Health Doctor (3-5s):** Deteksi model hidup/mati & buat baris model aktif Cursor |
| `--combos` | `false` | **Combo Architect:** Scan cepat & racik 4 rekomendasi Combo 9Router siap copy-paste |
| `-s, --stress` | `false` | **Deep Stress Test:** Uji batas limit seluruh model endpoint secara berurutan |
| `-u, --url <url>` | `http://localhost:20128/v1` | URL endpoint AI Router (mendukung local / VPS / CF Tunnel) |
| `-k, --key <key>` | `9router` | API Key 9Router Anda |
| `-m, --model <model>` | `claude-3-5-sonnet` | Model AI tunggal yang ingin diuji |
| `-b, --burst <n>` | `15` | Total request (atau jumlah panggilan per model) |
| `-c, --concurrency <n>` | `5` | Jumlah worker paralel serentak |
| `--mode <rpm\|tpm>` | `rpm` | `rpm` (hemat token) atau `tpm` (token besar) |
| `--max-tokens <n>` | `5` (RPM) / `1000` (TPM) | Jumlah token maksimum per request (misal: `2000` atau `4000` untuk konsumsi token masif) |
| `--stream` | `false` | Aktifkan streaming untuk mengukur Time-To-First-Token (TTFT) |
| `-o, --export <path>` | *None* | Path untuk menyimpan file laporan JSON |
| `-i, --interactive` | `false` | Memaksa menjalankan wizard interaktif |
| `-h, --help` | - | Tampilkan panduan opsi |

---

## 📊 Contoh Tampilan Hasil Pengujian

```text
╔═══════════════════════════════════════════════════════════╗
║            9ROUTER AI STRESS-TEST BENCHMARK               ║
╚═══════════════════════════════════════════════════════════╝
Target URL   : http://localhost:20128/v1
Target Model : claude-3-5-sonnet
Test Mode    : RPM
Total Burst  : 20 requests
Concurrency  : 5 concurrent workers
────────────────────────────────────────────────────────────

📊 BENCHMARK OVERVIEW
┌─────────────────────┬──────────────────────┐
│ Metric              │ Value                │
├─────────────────────┼──────────────────────┤
│ Total Requests      │ 20                   │
│ Total Time          │ 2.45 seconds         │
│ Throughput          │ 8.16 req/s           │
│ Success (200 OK)    │ 16                   │
│ Rate Limits (429)   │ 4                    │
│ Smart Fallbacks     │ 4                    │
│ Timeouts            │ 0                    │
│ Server Errors (5xx) │ 0                    │
└─────────────────────┴──────────────────────┘

⏱️  LATENCY PERCENTILES (200 OK)
┌───────┬───────┬───────┬───────┬───────┬───────┬───────┐
│ Min   │ Avg   │ p50   │ p90   │ p95   │ p99   │ Max   │
├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│ 312ms │ 480ms │ 450ms │ 620ms │ 710ms │ 890ms │ 890ms │
└───────┴───────┴───────┴───────┴───────┴───────┴───────┘

⚡ SMART FALLBACK DETECTED:
  9Router automatically redirected 4 requests to alternate provider models!
┌────────────────────────────┬───────────────┐
│ Provider / Model Responded │ Request Count │
├────────────────────────────┼───────────────┤
│ deepseek-chat              │ 4             │
│ claude-3-5-sonnet          │ 12            │
└────────────────────────────┴───────────────┘
```

---

## 🛠️ Konfigurasi `.env` (Opsional)

Buat file `.env` dari template `.env.example`:
```bash
cp .env.example .env
```
Isi konfigurasi default Anda agar tidak perlu mengetikkan flag URL dan API Key setiap kali menjalankan test.

---

## 🧪 Menjalankan Mock Verification Test

Anda dapat memverifikasi seluruh fungsi pelaporan, kalkulasi latensi, dan deteksi 429/fallback secara offline tanpa memerlukan koneksi internet:

```bash
npm run test:mock
```

---

## 🤝 Kontribusi

Pull requests dan issues sangat kami sambut! Jika Anda menemukan format header baru pada 9Router versi terbaru atau memiliki ide metrik tambahan, jangan ragu untuk membuka issue di GitHub.

## 📄 Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE).
