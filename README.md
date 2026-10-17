# ⚡ 9Router AI Stress Tester

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![9Router Compatible](https://img.shields.io/badge/9Router-Compatible-FF6B6B)](https://github.com/decolua/9router)

> **High-performance CLI benchmarking and stress-testing tool tailored for [9Router](https://github.com/decolua/9router) and its upstream AI providers.**
> 
> *Uji batas rate limit (HTTP 429 / RPM / TPM) provider AI dan validasi apakah fitur Smart Auto-Fallback 9Router Anda bekerja mulus tanpa error.*

---

## 🌟 Key Features / Fitur Utama

- 💥 **Aggressive Burst Engine:** Kirim lonjakan request serentak dalam hitungan milidetik untuk menguji ketahanan gateway dan mendeteksi titik rate-limit provider seketika.
- 🛡️ **Smart Fallback Detection:** Otomatis mendeteksi saat provider utama limit dan 9Router mengalihkan request ke model lapis kedua (misal: Claude $\rightarrow$ DeepSeek/Gemini).
- 💰 **Dual Testing Modes:**
  - **`--mode rpm` (Hemat Token):** Menggunakan prompt 1 kata (`ping`) dan `max_tokens: 5`. Menghantam batas panggilan per menit tanpa membakar kuota/biaya API.
  - **`--mode tpm` (Beban Token Berat):** Mengirim payload token besar (konteks 1000+ token) untuk menguji kuota token per menit upstream.
- 🧙 **Interactive CLI Wizard:** Cukup jalankan `npm start`, dan wizard interaktif (tanya-jawab) akan memandu Anda menentukan URL, Model, dan Concurrency.
- ⏱️ **Comprehensive Metrics:** Menghitung Throughput (RPS), status code breakdown, serta tabel persentil latensi lengkap (`p50`, `p90`, `p95`, `p99`, `Min`, `Max`, `Avg`).
- 📁 **JSON Export:** Simpan hasil pengujian lengkap ke file JSON untuk audit atau benchmarking performa berkala.

---

## 🚀 Quick Start / Cara Memulai

### 1. Prasyarat
- [Node.js](https://nodejs.org/) v18.0.0 atau lebih baru.
- Instance **9Router** yang sedang aktif (di localhost, VPS, atau via Cloudflare Tunnel).

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
| `-m, --model <model>` | `claude-3-5-sonnet` | Model AI yang ingin diuji |
| `-b, --burst <n>` | `15` | Total request yang akan dikirim |
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
