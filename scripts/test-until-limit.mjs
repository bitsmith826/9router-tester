import chalk from 'chalk';

const URL = process.env.ROUTER_URL || 'http://127.0.0.1:8318/v1/chat/completions';
const API_KEY = process.env.API_KEY || 'bebas';
const MODEL = process.argv[2] || 'glm-5.3-flash-free';
const DELAY_MS = parseInt(process.argv[3] || '500', 10);
const MAX_REQUESTS = parseInt(process.argv[4] || '200', 10);

console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
console.log(chalk.bold.cyan('║      🎯 TEST SAMPAI KETEMU LIMIT & HITUNG TOTAL TOKEN     ║'));
console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝'));
console.log(`Endpoint      : ${chalk.white.bold(URL)}`);
console.log(`Target Model  : ${chalk.yellow.bold(MODEL)}`);
console.log(`Delay Pacing  : ${chalk.white.bold(DELAY_MS + ' ms')}`);
console.log(`Max Requests  : ${chalk.white.bold(MAX_REQUESTS.toString())}`);
console.log('─'.repeat(60) + '\n');

const prompt = 'Jelaskan konsep asynchronous event loop dan concurrency pada Node.js beserta contoh arsitektur mikroservis.';

let totalPromptTokens = 0;
let totalCompletionTokens = 0;
let totalTokens = 0;
let successCount = 0;
let limitHit = false;
let limitError = '';
let startTime = Date.now();

for (let reqId = 1; reqId <= MAX_REQUESTS; reqId++) {
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
        max_tokens: 300,
        temperature: 0.3
      })
    });

    const latency = Date.now() - reqStart;

    if (res.status === 200) {
      const data = await res.json();
      const usage = data.usage || {};
      const pTok = usage.prompt_tokens || 50;
      const cTok = usage.completion_tokens || 150;
      const tTok = usage.total_tokens || (pTok + cTok);

      totalPromptTokens += pTok;
      totalCompletionTokens += cTok;
      totalTokens += tTok;
      successCount++;

      console.log(
        `${chalk.gray(`[Req #${reqId}]`)} ` +
        `${chalk.green.bold('200 OK')} ` +
        `${chalk.gray(`(${latency}ms)`)} | ` +
        `+${tTok.toLocaleString()} tok ` +
        `(${pTok} in / ${cTok} out) | ` +
        `${chalk.cyan.bold(`Akumulasi: ${totalTokens.toLocaleString()} Token`)}`
      );

      if (DELAY_MS > 0) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    } else if (res.status === 429) {
      limitHit = true;
      const errText = await res.text();
      try {
        const parsed = JSON.parse(errText);
        limitError = parsed.error?.message || parsed.message || errText;
      } catch (_) {
        limitError = errText;
      }
      console.log(
        `\n${chalk.red.bold(`🚨 LIMIT TERBENTUR DI REQUEST #${reqId} (HTTP 429)!`)}\n` +
        chalk.red(`Pesan: ${limitError}`)
      );
      break;
    } else {
      const errText = await res.text();
      console.log(chalk.yellow(`[Req #${reqId}] HTTP ${res.status}: ${errText.slice(0, 80)}`));
    }
  } catch (err) {
    console.log(chalk.red(`[Req #${reqId}] Network Error: ${err.message}`));
  }
}

const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n' + '═'.repeat(60));
console.log(chalk.bold.white('📊 LAPORAN AKHIR: KONSUMSI TOKEN SAMPAI TITIK LIMIT'));
console.log('═'.repeat(60));
console.log(`Model Diuji                : ${chalk.yellow.bold(MODEL)}`);
console.log(`Total Request Berhasil     : ${chalk.green.bold(successCount.toString())} request`);
console.log(`Waktu Pengujian            : ${chalk.white(elapsedSec)} detik`);
console.log(`Prompt Tokens (Input)      : ${chalk.white(totalPromptTokens.toLocaleString())} token`);
console.log(`Completion Tokens (Output) : ${chalk.white(totalCompletionTokens.toLocaleString())} token`);
console.log('─'.repeat(60));
console.log(chalk.bold.green(`🏆 TOTAL TOKEN DIKONSUMSI  : ${chalk.bold.cyan(totalTokens.toLocaleString())} TOKEN`));
console.log('─'.repeat(60));
if (limitHit) {
  console.log(chalk.red.bold(`Status Limit               : TERBENTUR (HTTP 429)`));
  console.log(chalk.red(`Detail Error Upstream      : ${limitError}`));
} else {
  console.log(chalk.green.bold(`Status Limit               : BELUM TERBENTUR (Semua ${successCount} req lolos)`));
}
console.log('═'.repeat(60) + '\n');
