import chalk from 'chalk';

const URL = process.env.ROUTER_URL || 'http://127.0.0.1:8318/v1/chat/completions';
const API_KEY = process.env.API_KEY || 'bebas';
const MODEL = process.argv[2] || 'glm-5.3-flash-free';
const TARGET_TOKENS = parseInt(process.argv[3] || '50000', 10);

console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
console.log(chalk.bold.cyan('║     🔬 DEEP DIAGNOSTIC & RESILIENT TRACKER: GLM-5.3       ║'));
console.log(chalk.bold.cyan('║      Pantau Header, Analisis 429/403, & Auto-Backoff      ║'));
console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝'));
console.log(`Endpoint      : ${chalk.white.bold(URL)}`);
console.log(`Target Model  : ${chalk.yellow.bold(MODEL)}`);
console.log(`Target Token  : ${chalk.green.bold(TARGET_TOKENS.toLocaleString())}`);
console.log('─'.repeat(60) + '\n');

const prompt = 'Jelaskan konsep arsitektur microservices dan distributed caching dengan Redis secara mendalam.';

let totalPromptTokens = 0;
let totalCompletionTokens = 0;
let totalTokens = 0;
let successCount = 0;
let errorStats = {};
let reqId = 0;
const startTime = Date.now();

async function sendRequestWithDiagnostics(attemptModel) {
  const reqStart = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: attemptModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.2
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const latency = Date.now() - reqStart;
    const headers = Object.fromEntries(res.headers.entries());

    if (res.ok) {
      const data = await res.json();
      const usage = data.usage || {};
      const pTok = usage.prompt_tokens || 30;
      const cTok = usage.completion_tokens || 100;
      const tTok = usage.total_tokens || (pTok + cTok);

      return {
        ok: true,
        statusCode: res.status,
        latency,
        pTok,
        cTok,
        tTok,
        headers,
        modelUsed: data.model || attemptModel
      };
    } else {
      const rawBody = await res.text();
      let parsed = {};
      try {
        parsed = JSON.parse(rawBody);
      } catch (_) {}

      return {
        ok: false,
        statusCode: res.status,
        latency,
        rawBody,
        parsed,
        headers
      };
    }
  } catch (err) {
    clearTimeout(timeout);
    return {
      ok: false,
      statusCode: 0,
      latency: Date.now() - reqStart,
      rawBody: err.message,
      headers: {}
    };
  }
}

// Loop eksekusi sampai target token atau limit permanen
while (totalTokens < TARGET_TOKENS && reqId < 150) {
  reqId++;
  const result = await sendRequestWithDiagnostics(MODEL);

  if (result.ok) {
    totalPromptTokens += result.pTok;
    totalCompletionTokens += result.cTok;
    totalTokens += result.tTok;
    successCount++;

    console.log(
      `${chalk.gray(`[Req #${reqId}]`)} ` +
      `${chalk.green.bold('200 OK')} (${result.latency}ms) | ` +
      `+${result.tTok} tok (${result.pTok} in / ${result.cTok} out) | ` +
      `${chalk.cyan.bold(`Akumulasi: ${totalTokens.toLocaleString()} Token`)}`
    );

    // Jeda wajar 300ms
    await new Promise((r) => setTimeout(r, 300));
  } else {
    // TRACK & BEDAH ERROR SECARA DETAIL
    const errKey = `HTTP_${result.statusCode}`;
    errorStats[errKey] = (errorStats[errKey] || 0) + 1;

    console.log('\n' + chalk.red.bold(`⚠️ DETEKSI ERROR DI REQUEST #${reqId} (${result.statusCode}):`));
    console.log(chalk.yellow(`  Latency Sampai Error : ${result.latency}ms`));

    // Analisis Header Rate Limit / Provider
    const interestingHeaders = [
      'retry-after',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'x-provider',
      'server',
      'cf-ray'
    ];
    console.log(chalk.gray('  --- Header Diagnostic ---'));
    for (const h of interestingHeaders) {
      if (result.headers[h]) {
        console.log(`  Header ${chalk.bold(h)}: ${chalk.white(result.headers[h])}`);
      }
    }

    // Analisis Body Error
    console.log(chalk.gray('  --- Raw Error Body ---'));
    console.log(chalk.red(`  ${result.rawBody.slice(0, 300)}`));

    // Kluster Diagnosis
    if (result.statusCode === 429) {
      if (result.rawBody.includes('Endpoint is unavailable')) {
        console.log(chalk.magenta('  🔍 Diagnosa: Server OpenCode upstream sedang overload/down sementara (bukan kuota habis, tapi provider drop).'));
      } else if (result.rawBody.includes('FreeUsageLimitError')) {
        console.log(chalk.magenta('  🔍 Diagnosa: Free Tier sliding window RPM terpicu. Butuh jeda cooldown.'));
      }
    } else if (result.statusCode === 403) {
      console.log(chalk.magenta('  🔍 Diagnosa: 403 Forbidden. Kemungkinan IP Cloudflare/WAF block atau token expired.'));
    }

    // STRATEGI: JANGAN LANGSUNG MENYERAH! COBA SMART BACKOFF RETRY
    console.log(chalk.cyan.bold('  🔄 Menjalankan Smart Backoff (Tunggu 5 detik lalu coba lagi)...'));
    await new Promise((r) => setTimeout(r, 5000));

    // Retry 1 kali setelah backoff
    const retryResult = await sendRequestWithDiagnostics(MODEL);
    if (retryResult.ok) {
      console.log(chalk.green.bold(`  ✅ BERHASIL PULIH SETELAH JEDA! Lanjut eksekusi...`));
      totalPromptTokens += retryResult.pTok;
      totalCompletionTokens += retryResult.cTok;
      totalTokens += retryResult.tTok;
      successCount++;
    } else {
      console.log(chalk.yellow(`  ⏳ Masih belum pulih (${retryResult.statusCode}). Mencoba backoff kedua (10 detik)...`));
      await new Promise((r) => setTimeout(r, 10000));

      const retry2 = await sendRequestWithDiagnostics(MODEL);
      if (retry2.ok) {
        console.log(chalk.green.bold(`  ✅ BERHASIL PULIH PADA BACKOFF KE-2! Lanjut...`));
        totalPromptTokens += retry2.pTok;
        totalCompletionTokens += retry2.cTok;
        totalTokens += retry2.tTok;
        successCount++;
      } else {
        console.log(chalk.red.bold(`  ⛔ Upstream masih mengunci (${retry2.statusCode}). Melaporkan temuan rincian error.`));
        break;
      }
    }
  }
}

const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n' + '═'.repeat(60));
console.log(chalk.bold.white('📊 REKAP DIAGNOSIS GLM-5.3 & KONSUMSI TOKEN'));
console.log('═'.repeat(60));
console.log(`Model                       : ${chalk.yellow.bold(MODEL)}`);
console.log(`Total Request Sukses        : ${chalk.green.bold(successCount.toString())}`);
console.log(`Total Token yang Dikonsumsi : ${chalk.bold.cyan(totalTokens.toLocaleString())} TOKEN`);
console.log(`Distribusi Error            : ${JSON.stringify(errorStats)}`);
console.log(`Durasi Pengujian            : ${elapsedSec} detik`);
console.log('═'.repeat(60) + '\n');
