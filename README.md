# ⚡ Universal AI Router & Gateway Stress Tester
### *(9Router • One API • New API • LiteLLM • OpenRouter • Ollama • vLLM)*

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Universal OpenAI Compatible](https://img.shields.io/badge/OpenAI--API-Compatible-412991)](https://platform.openai.com/)

> **High-performance CLI benchmarking, rate-limit stress-testing, and dynamic model discovery tool for ANY AI Gateway / Router (9Router, One API, New API, LiteLLM, OpenRouter, Ollama, vLLM, Portkey).**
> 
> *Uji batas rate limit (HTTP 429 / RPM / TPM) upstream provider AI dan validasi apakah fitur Smart Auto-Fallback router Anda bekerja mulus tanpa memutus koneksi.*

---

## ⚡ 30-Second Quickstart (Khusus Pengguna 9Router di Laptop)

Jika Anda menjalankan **9Router di laptop Anda (`localhost:20128`)**, Anda bisa langsung menguji batas limit provider dalam hitungan detik tanpa perlu mengubah file konfigurasi apa pun:

```bash
# 1. Clone repositori ini
git clone https://github.com/your-username/9router-stress-test.git
cd 9router-stress-test

# 2. Install dependensi & build
npm install
npm run build

# 3. Jalankan pengujian interaktif
npm start
```

### 🖥️ Simulasi Tampilan di Terminal Anda:

```text
╔═══════════════════════════════════════════════════════════╗
║      UNIVERSAL AI ROUTER & GATEWAY STRESS TESTER          ║
║  (9Router, One API, New API, LiteLLM, OpenRouter, Ollama) ║
╚═══════════════════════════════════════════════════════════╝

? AI Router Endpoint URL: http://localhost:20128/v1   <-- [Tekan Enter]
? API Key (kosongkan jika tidak perlu): 9router       <-- [Tekan Enter]
✔ Berhasil menemukan 12 model aktif dari 9Router!

? Pilih Target AI Model yang ingin diuji:
  > 🔥 [UJI SEMUA MODEL SEKALIGUS] (12 Model - Health Check & Limit Test)  <-- [PILIHAN INI!]
    🤖 claude-3-5-sonnet
    🤖 claude-3-5-haiku
    🤖 gpt-4o
    🤖 deepseek-chat
    ✏️  [Ketik nama model kustom secara manual...]

? Mode Pengujian Beban:
  > RPM Mode (Hemat token: 1 prompt ping, max 5 token - fokus menabrak limit)  <-- [Tekan Enter]
    TPM Mode (Beban token tinggi: payload konteks panjang)

? Jumlah Panggilan per Model (misal: 3 - cepat & hemat kuota): 3  <-- [Tekan Enter]
? Konkurensi Paralel (jumlah worker bersamaan): 5                  <-- [Tekan Enter]
? Simpan laporan benchmark ke file JSON? Yes                       <-- [Tekan Enter]

✔ All-models test finished: 12 models benchmarked.
[Tabel perbandingan kelayakan seluruh model langsung disajikan!]
```

---

## 🌟 Key Features / Fitur Utama

- 🔥 **Batch Health & Stress Test (All-Models at Once):** Tidak perlu menguji model satu per satu! Cukup pilih opsi *[UJI SEMUA MODEL SEKALIGUS]* atau pasang flag `-a, --all-models`. Tool otomatis mengecek seluruh model aktif di router Anda, memberi tanda mana yang **✔ ACTIVE (200)**, mana yang **⚡ FALLBACK**, mana yang **🚨 RATE LIMITED (429)**, dan mana yang **✖ DEAD/ERROR**.
- 🔍 **Dynamic Model Discovery (`/v1/models`):** Otomatis menghubungi endpoint router Anda untuk mengambil daftar model aktif yang tersedia dan menampilkannya sebagai pilihan di terminal. Juga menyediakan daftar preset model AI terpopuler (Claude 3.5, GPT-4o, Gemini 2.0, DeepSeek, Llama 3, Qwen) serta opsi ketik manual.
- 🌐 **Universal Gateway Support:** Dirancang untuk bekerja dengan semua proxy OpenAI-compatible: **9Router**, **One API**, **New API**, **LiteLLM**, **OpenRouter**, **Portkey**, **Ollama**, **vLLM**, atau endpoint mandiri.
- 💥 **Aggressive Burst Engine:** Kirim lonjakan request serentak dalam hitungan milidetik untuk menguji ketahanan gateway dan mendeteksi titik rate-limit provider seketika.
- 🛡️ **Universal Smart Fallback Detection:** Otomatis mendeteksi saat provider utama limit dan router mengalihkan request ke model lapis kedua (misal: Claude $\rightarrow$ DeepSeek/Gemini) lewat inspeksi model respon dan header gateway.
- 💰 **Dual Testing Modes:**
  - **`--mode rpm` (Hemat Token):** Menggunakan prompt 1 kata (`ping`) dan `max_tokens: 5`. Menghantam batas panggilan per menit tanpa membakar kuota/biaya API.
  - **`--mode tpm` (Beban Token Berat):** Mengirim payload token besar (konteks 1000+ token) untuk menguji kuota token per menit upstream.
- 🧙 **Interactive CLI Wizard:** Cukup jalankan `npm start`, dan wizard interaktif (tanya-jawab) akan memandu Anda menentukan URL, memilih Model dari daftar, dan mengatur Concurrency.
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
git clone https://github.com/your-username/9router-stress-test.git
cd 9router-stress-test

# Install dependencies
npm install

# Compile TypeScript
npm run build
```

---

## 💻 Penggunaan (Usage)

### Opsi A: Mode Wizard Interaktif (Paling Mudah)
Cukup jalankan tanpa argumen:
```bash
npm start
```
Wizard terminal akan memandu Anda memilih URL, API Key, Model, dan jumlah request secara interaktif!

---

### Opsi B: Menggunakan CLI Flags (Untuk Scripting / Cepat)

```bash
# Uji Burst 20 request ke 9Router lokal dengan model Claude (Mode RPM hemat token)
node dist/index.js --url http://localhost:20128/v1 --key 9router --model claude-3-5-sonnet --burst 20 --concurrency 5 --mode rpm

# Uji 9Router di VPS via Cloudflare Tunnel
node dist/index.js --url https://ai.domainanda.com/v1 --key RahasiaAnda123! --model gpt-4o --burst 30 --concurrency 10

# Uji Mode TPM (Token berat) dan simpan laporan ke JSON
node dist/index.js --model deepseek-chat --burst 15 --mode tpm --export reports/deepseek-tpm.json
```

---

## ⚙️ CLI Options & Flags

| Flag | Default | Deskripsi |
|---|---|---|
| `-u, --url <url>` | `http://localhost:20128/v1` | URL endpoint 9Router (mendukung local / VPS / CF Tunnel) |
| `-k, --key <key>` | `9router` | API Key 9Router Anda |
| `-m, --model <model>` | `claude-3-5-sonnet` | Model AI tunggal yang ingin diuji |
| `-a, --all-models` | `false` | **Uji seluruh model sekaligus** di endpoint secara berurutan |
| `-b, --burst <n>` | `15` | Total request (atau jumlah panggilan per model jika all-models) |
| `-c, --concurrency <n>` | `5` | Jumlah worker paralel serentak |
| `--mode <rpm\|tpm>` | `rpm` | `rpm` (hemat token) atau `tpm` (token besar) |
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
