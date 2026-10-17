#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { BenchmarkConfig, BenchmarkMode } from './types.js';
import { StressTestEngine } from './engine.js';
import { analyzeResults } from './analyzer.js';
import { BenchmarkReporter } from './reporter.js';

dotenv.config();

const program = new Command();

program
  .name('9router-stress-test')
  .description('High-performance CLI stress-testing and rate-limit benchmarking tool for 9Router AI Gateway.')
  .version('1.0.0')
  .option('-u, --url <url>', '9Router endpoint URL', process.env.ROUTER_URL || 'http://localhost:20128/v1')
  .option('-k, --key <key>', '9Router API Key', process.env.API_KEY || '9router')
  .option('-m, --model <model>', 'Target model to test', process.env.DEFAULT_MODEL || 'claude-3-5-sonnet')
  .option('-b, --burst <number>', 'Total burst requests to send', '15')
  .option('-c, --concurrency <number>', 'Concurrent workers', '5')
  .option('--mode <mode>', 'Test mode: rpm (minimal token) or tpm (heavy token)', 'rpm')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('--stream', 'Use streaming mode for TTFT benchmarking', false)
  .option('-o, --export <path>', 'Path to save detailed JSON report')
  .option('-i, --interactive', 'Launch interactive setup wizard', false);

import { fetchRouterModels, POPULAR_MODEL_PRESETS } from './models.js';

async function promptInteractiveWizard(defaults: Partial<BenchmarkConfig>): Promise<BenchmarkConfig> {
  console.log('\n' + chalk.cyan.bold('╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║      UNIVERSAL AI ROUTER & GATEWAY STRESS TESTER          ║'));
  console.log(chalk.cyan.bold('║  (9Router, One API, New API, LiteLLM, OpenRouter, Ollama) ║'));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════╝\n'));

  // Step 1: Endpoint & Auth
  const connectionAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'AI Router Endpoint URL:',
      default: defaults.url || 'http://localhost:20128/v1',
      validate: (input: string) => input.trim().length > 0 || 'URL cannot be empty'
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (kosongkan jika tidak perlu):',
      default: defaults.apiKey || '9router'
    }
  ]);

  // Step 2: Fetch model list dynamically from the router
  const modelSpinner = ora({
    text: chalk.gray(`Menghubungi ${connectionAnswers.url} untuk mengambil daftar model AI (/v1/models)...`),
    color: 'yellow'
  }).start();

  const fetchedModels = await fetchRouterModels(connectionAnswers.url, connectionAnswers.apiKey);
  
  let modelChoices: Array<{ name: string; value: string }>;
  const CUSTOM_MODEL_KEY = '__CUSTOM_MODEL_INPUT__';

  if (fetchedModels.length > 0) {
    modelSpinner.succeed(chalk.green(`Berhasil menemukan ${fetchedModels.length} model aktif dari router!`));
    modelChoices = [
      ...fetchedModels.map(m => ({ name: `🤖 ${m}`, value: m })),
      { name: chalk.yellow('✏️  [Ketik nama model kustom secara manual...]'), value: CUSTOM_MODEL_KEY }
    ];
  } else {
    modelSpinner.info(
      chalk.gray('Router tidak mengekspos /v1/models atau offline. Menampilkan daftar model AI populer:')
    );
    modelChoices = [
      ...POPULAR_MODEL_PRESETS.map(m => ({ name: `🤖 ${m}`, value: m })),
      { name: chalk.yellow('✏️  [Ketik nama model kustom secara manual...]'), value: CUSTOM_MODEL_KEY }
    ];
  }

  // Step 3: Select model and parameters
  const testAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedModel',
      message: 'Pilih Target AI Model yang ingin diuji:',
      choices: modelChoices,
      default: defaults.model && modelChoices.some(c => c.value === defaults.model)
        ? defaults.model
        : modelChoices[0].value,
      pageSize: 15
    },
    {
      type: 'input',
      name: 'customModel',
      message: 'Masukkan nama model AI:',
      when: (ans: any) => ans.selectedModel === CUSTOM_MODEL_KEY,
      validate: (input: string) => input.trim().length > 0 || 'Model tidak boleh kosong'
    },
    {
      type: 'list',
      name: 'mode',
      message: 'Mode Pengujian Beban:',
      choices: [
        {
          name: 'RPM Mode (Hemat token: 1 prompt ping, max 5 token - fokus menabrak batas limit panggilan/menit)',
          value: 'rpm'
        },
        {
          name: 'TPM Mode (Beban token tinggi: payload konteks panjang - fokus menabrak batas token/menit)',
          value: 'tpm'
        }
      ],
      default: defaults.mode || 'rpm'
    },
    {
      type: 'number',
      name: 'burstTotal',
      message: 'Total Burst Request (jumlah panggilan):',
      default: defaults.burstTotal || 20,
      validate: (val: number) => val > 0 || 'Harus lebih dari 0'
    },
    {
      type: 'number',
      name: 'concurrency',
      message: 'Konkurensi Paralel (jumlah worker bersamaan):',
      default: defaults.concurrency || 5,
      validate: (val: number) => val > 0 || 'Harus lebih dari 0'
    },
    {
      type: 'confirm',
      name: 'saveReport',
      message: 'Simpan laporan benchmark ke file JSON?',
      default: true
    },
    {
      type: 'input',
      name: 'exportPath',
      message: 'Lokasi simpan file JSON:',
      default: 'reports/benchmark-result.json',
      when: (ans: any) => ans.saveReport
    }
  ]);

  const targetModel = testAnswers.selectedModel === CUSTOM_MODEL_KEY
    ? testAnswers.customModel
    : testAnswers.selectedModel;

  return {
    url: connectionAnswers.url,
    apiKey: connectionAnswers.apiKey,
    model: targetModel,
    burstTotal: testAnswers.burstTotal,
    concurrency: testAnswers.concurrency,
    mode: testAnswers.mode as BenchmarkMode,
    timeoutMs: defaults.timeoutMs || 30000,
    stream: defaults.stream || false,
    exportPath: testAnswers.exportPath
  };
}

async function main() {
  program.parse(process.argv);
  const opts = program.opts();

  const isExplicitFlagProvided = process.argv.length > 2 && !opts.interactive;

  let config: BenchmarkConfig;

  if (opts.interactive || !isExplicitFlagProvided) {
    config = await promptInteractiveWizard({
      url: opts.url,
      apiKey: opts.key,
      model: opts.model,
      burstTotal: parseInt(opts.burst, 10),
      concurrency: parseInt(opts.concurrency, 10),
      mode: (opts.mode.toLowerCase() === 'tpm' ? 'tpm' : 'rpm') as BenchmarkMode,
      timeoutMs: parseInt(opts.timeout, 10),
      stream: Boolean(opts.stream),
      exportPath: opts.export
    });
  } else {
    config = {
      url: opts.url,
      apiKey: opts.key,
      model: opts.model,
      burstTotal: parseInt(opts.burst, 10),
      concurrency: parseInt(opts.concurrency, 10),
      mode: (opts.mode.toLowerCase() === 'tpm' ? 'tpm' : 'rpm') as BenchmarkMode,
      timeoutMs: parseInt(opts.timeout, 10),
      stream: Boolean(opts.stream),
      exportPath: opts.export
    };
  }

  BenchmarkReporter.printHeader(config);

  const spinner = ora({
    text: chalk.cyan(`Launching aggressive burst (${config.burstTotal} requests, concurrency: ${config.concurrency})...`),
    color: 'cyan'
  }).start();

  const engine = new StressTestEngine(config);
  const startTime = new Date();

  let okCount = 0;
  let limitCount = 0;
  let errorCount = 0;

  const results = await engine.run((completed, total, latest) => {
    if (latest.statusCode === 200) okCount++;
    else if (latest.statusCode === 429) limitCount++;
    else errorCount++;

    const statusBadge = latest.statusCode === 200
      ? chalk.green('200 OK')
      : latest.statusCode === 429
        ? chalk.red.bold('429 LIMIT')
        : chalk.yellow(`HTTP ${latest.statusCode}`);

    spinner.text = `[${completed}/${total}] Last: ${statusBadge} (${latest.latencyMs}ms) | ` +
      `${chalk.green('OK: ' + okCount)} | ` +
      `${chalk.red('Limit(429): ' + limitCount)} | ` +
      `${chalk.gray('Err: ' + errorCount)}`;
  });

  const endTime = new Date();
  spinner.succeed(chalk.green(`Stress test finished: ${results.length} requests executed.`));

  const summary = analyzeResults(config, results, startTime, endTime);
  BenchmarkReporter.printSummary(summary, results);
}

main().catch((err) => {
  console.error(chalk.red.bold('\nFatal Error:'), err.message || err);
  process.exit(1);
});
