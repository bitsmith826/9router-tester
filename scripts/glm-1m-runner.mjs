import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const URL = process.env.ROUTER_URL || 'http://127.0.0.1:8318/v1/chat/completions';
const API_KEY = process.env.API_KEY || 'bebas';
const MODEL = process.env.TARGET_MODEL || 'glm-5.3-flash-free';
const TARGET_TOKENS = 1_000_000;
const PROGRESS_FILE = path.resolve('reports/glm-1m-progress.json');

// Pastikan direktori reports ada
const reportsDir = path.dirname(PROGRESS_FILE);
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
console.log(chalk.bold.cyan('║      🚀 MARATHON 1 JUTA TOKEN RUNNER: GLM-5.3-FLASH       ║'));
console.log(chalk.bold.cyan('║     Resilient Pacing • Auto-Backoff • Live Checkpoint     ║'));
console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝'));
console.log(`Endpoint      : ${chalk.white.bold(URL)}`);
console.log(`Target Model  : ${chalk.yellow.bold(MODEL)}`);
console.log(`Target Token  : ${chalk.green.bold('1.000.000 TOKEN')}`);
console.log(`Progress File : ${chalk.gray(PROGRESS_FILE)}`);
console.log('─'.repeat(60) + '\n');

// Prompt berbobot optimal (~750 input token + ~350 output token = ~1.100 token/req)
const prompt = `
Jelaskan arsitektur database terdistribusi modern (seperti CockroachDB, TiDB, dan Google Spanner).
Fokuskan penjelasan pada aspek-aspek krusial berikut:
1. Konsensus Raft vs Paxos untuk replikasi data antar region.
2. Mekanisme Multi-Version Concurrency Control (MVCC) dan isolasi transaksi Serializable.
3. Sinkronisasi waktu menggunakan TrueTime API (Atomic Clocks + GPS) vs Hybrid Logical Clocks (HLC).
4. Strategi sharding dinamis, split-range, dan load rebalancing pada cluster berkapasitas petabyte.
Berikan analisis teknis mendalam dengan penjelasan terstruktur.
`.trim();

let totalPromptTokens = 0;
let totalCompletionTokens = 0;
let totalTokens = 0;
let successCount = 0;
let reqId = 0;
const startTime = Date.now();

function saveProgress(status = 'RUNNING') {
  try {
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const tps = elapsedSec > 0 ? Math.round(totalTokens / elapsedSec) : 0;
    const progressData = {
      targetTokens: TARGET_TOKENS,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      successCount,
      percentComplete: parseFloat(((totalTokens / TARGET_TOKENS) * 100).toFixed(2)),
      elapsedSeconds: elapsedSec,
      tokensPerSecond: tps,
      estimatedMinutesRemaining: tps > 0 ? Math.round((TARGET_TOKENS - totalTokens) / tps / 60) : 0,
      status,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2), 'utf-8');
  } catch (_) {}
}

async function sendRequestWithResilience() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  const reqStart = Date.now();

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 350,
        temperature: 0.2
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const latency = Date.now() - reqStart;

    if (res.ok) {
      const data = await res.json();
      const usage = data.usage || {};
      const pTok = usage.prompt_tokens || 750;
      const cTok = usage.completion_tokens || 350;
      const tTok = usage.total_tokens || (pTok + cTok);
      return { ok: true, statusCode: res.status, latency, pTok, cTok, tTok };
    } else {
      const rawBody = await res.text();
      return { ok: false, statusCode: res.status, latency, rawBody };
    }
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, statusCode: 0, latency: Date.now() - reqStart, rawBody: err.message };
  }
}

// Tangani Ctrl+C agar progress tersimpan rapi
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n[PAUSED] Menerima sinyal berhenti. Menyimpan checkpoint progres...'));
  saveProgress('PAUSED');
  console.log(chalk.green(`Checkpoint tersimpan di: ${PROGRESS_FILE}`));
  process.exit(0);
});

// Loop eksekusi menuju 1.000.000 token
while (totalTokens < TARGET_TOKENS) {
  reqId++;
  const result = await sendRequestWithResilience();

  if (result.ok) {
    totalPromptTokens += result.pTok;
    totalCompletionTokens += result.cTok;
    totalTokens += result.tTok;
    successCount++;

    const percent = ((totalTokens / TARGET_TOKENS) * 100).toFixed(1);
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const tps = elapsedSec > 0 ? Math.round(totalTokens / elapsedSec) : 0;

    console.log(
      `${chalk.gray(`[Req #${reqId}]`)} ` +
      `${chalk.green.bold('200 OK')} (${result.latency}ms) | ` +
      `+${result.tTok.toLocaleString()} tok | ` +
      `${chalk.cyan.bold(`${totalTokens.toLocaleString()} / 1.000.000 (${percent}%)`)} | ` +
      `${chalk.yellow(`${tps} tok/s`)}`
    );

    // Simpan progres ke file setiap 5 request
    if (reqId % 5 === 0) {
      saveProgress('RUNNING');
    }

    // Jeda aman terbukti: 350ms
    await new Promise((r) => setTimeout(r, 350));
  } else {
    console.log(chalk.red(`\n[Req #${reqId}] Error HTTP ${result.statusCode}: ${result.rawBody?.slice(0, 100)}`));
    console.log(chalk.yellow('🔄 Mengaktifkan Smart Backoff: Jeda 7 detik sebelum melanjutkan...'));
    await new Promise((r) => setTimeout(r, 7000));
  }
}

saveProgress('COMPLETED');

const totalDurationMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

console.log('\n' + '═'.repeat(60));
console.log(chalk.bold.green('🎉 TARGET 1.000.000 TOKEN RESMI TERCAPAI PENUH! 🎉'));
console.log('═'.repeat(60));
console.log(`Model Target               : ${chalk.yellow.bold(MODEL)}`);
console.log(`Total Request Sukses       : ${chalk.white.bold(successCount.toString())} request`);
console.log(`Prompt Tokens (Input)      : ${chalk.white(totalPromptTokens.toLocaleString())} token`);
console.log(`Completion Tokens (Output) : ${chalk.white(totalCompletionTokens.toLocaleString())} token`);
console.log('─'.repeat(60));
console.log(chalk.bold.cyan(`🏆 TOTAL TOKEN DIKONSUMSI  : ${chalk.bold.green(totalTokens.toLocaleString())} TOKEN`));
console.log(`Durasi Pengujian           : ${chalk.white(totalDurationMin)} menit`);
console.log(`Laporan Tersimpan di       : ${chalk.gray(PROGRESS_FILE)}`);
console.log('═'.repeat(60) + '\n');
