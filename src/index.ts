#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import {
  BenchmarkConfig,
  BenchmarkMode,
  DeadModelInfo,
  ModelHealthStatus,
  MultiModelBenchmarkReport
} from './types.js';
import { StressTestEngine } from './engine.js';
import { analyzeResults } from './analyzer.js';
import { BenchmarkReporter } from './reporter.js';
import {
  fetchRouterModels,
  POPULAR_MODEL_PRESETS,
  QUICK_SCAN_KEY,
  DEEP_STRESS_ALL_KEY,
  CUSTOM_MODEL_KEY
} from './models.js';

dotenv.config();

const program = new Command();

program
  .name('9router-stress-test')
  .description('High-performance CLI stress-testing, health scanner, and rate-limit benchmarking tool for 9Router and Universal AI Gateways.')
  .version('1.2.0')
  .option('-u, --url <url>', 'AI Router endpoint URL', process.env.ROUTER_URL || 'http://localhost:20128/v1')
  .option('-k, --key <key>', 'AI Router API Key', process.env.API_KEY || '9router')
  .option('-m, --model <model>', 'Target model to test', process.env.DEFAULT_MODEL || 'claude-3-5-sonnet')
  .option('-q, --quick-scan', 'Run instant Quick Health Scan (paralel 3-5s untuk cek model hidup/mati)', false)
  .option('-a, --all-models', 'Deep stress test ALL discovered models with burst load', false)
  .option('-b, --burst <number>', 'Burst requests count (total or per-model)', '15')
  .option('-c, --concurrency <number>', 'Concurrent workers', '5')
  .option('--mode <mode>', 'Test mode: rpm (minimal token) or tpm (heavy token)', 'rpm')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('--stream', 'Use streaming mode for TTFT benchmarking', false)
  .option('-o, --export <path>', 'Path to save detailed JSON report')
  .option('-i, --interactive', 'Launch interactive setup wizard', false);

async function promptInteractiveWizard(defaults: Partial<BenchmarkConfig>): Promise<BenchmarkConfig> {
  console.log('\n' + chalk.cyan.bold('╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║           9ROUTER STRESS TEST & AI MODEL DOCTOR           ║'));
  console.log(chalk.cyan.bold('║  (Compatible with 9Router, One API, LiteLLM, OpenRouter)  ║'));
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
  const availableModelList = fetchedModels.length > 0 ? fetchedModels : POPULAR_MODEL_PRESETS;
  
  let modelChoices: Array<{ name: string; value: string }>;

  if (fetchedModels.length > 0) {
    modelSpinner.succeed(chalk.green(`Berhasil menemukan ${fetchedModels.length} model aktif dari router!`));
    modelChoices = [
      {
        name: chalk.green.bold(`🩺 [QUICK HEALTH SCAN] Pindai Cepat Model Hidup & Mati (3-5 Detik Selesai)`),
        value: QUICK_SCAN_KEY
      },
      {
        name: chalk.yellow.bold(`💥 [DEEP STRESS TEST] Uji Limit & Throughput Semua Model (${fetchedModels.length} Model)`),
        value: DEEP_STRESS_ALL_KEY
      },
      ...fetchedModels.map(m => ({ name: `🤖 ${m}`, value: m })),
      { name: chalk.gray('✏️  [Ketik nama model kustom secara manual...]'), value: CUSTOM_MODEL_KEY }
    ];
  } else {
    modelSpinner.info(
      chalk.gray('Router tidak mengekspos /v1/models atau offline. Menampilkan daftar model AI populer:')
    );
    modelChoices = [
      {
        name: chalk.green.bold(`🩺 [QUICK HEALTH SCAN] Pindai Cepat Model Populer Hidup & Mati`),
        value: QUICK_SCAN_KEY
      },
      {
        name: chalk.yellow.bold(`💥 [DEEP STRESS TEST] Uji Limit Seluruh Model Populer`),
        value: DEEP_STRESS_ALL_KEY
      },
      ...POPULAR_MODEL_PRESETS.map(m => ({ name: `🤖 ${m}`, value: m })),
      { name: chalk.gray('✏️  [Ketik nama model kustom secara manual...]'), value: CUSTOM_MODEL_KEY }
    ];
  }

  // Step 3: Select Action or Model
  const testAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedOption',
      message: 'Pilih Aksi Pengujian:',
      choices: modelChoices,
      default: defaults.scanMode === 'quick-scan'
        ? QUICK_SCAN_KEY
        : defaults.allModels
          ? DEEP_STRESS_ALL_KEY
          : defaults.model && modelChoices.some(c => c.value === defaults.model)
            ? defaults.model
            : modelChoices[0].value,
      pageSize: 15
    },
    {
      type: 'input',
      name: 'customModel',
      message: 'Masukkan nama model AI:',
      when: (ans: any) => ans.selectedOption === CUSTOM_MODEL_KEY,
      validate: (input: string) => input.trim().length > 0 || 'Model tidak boleh kosong'
    },
    {
      type: 'list',
      name: 'mode',
      message: 'Mode Pengujian Beban:',
      choices: [
        {
          name: 'RPM Mode (Hemat token: 1 prompt ping, max 5 token - fokus menabrak batas limit)',
          value: 'rpm'
        },
        {
          name: 'TPM Mode (Beban token tinggi: payload konteks panjang - fokus menabrak batas token)',
          value: 'tpm'
        }
      ],
      default: defaults.mode || 'rpm',
      when: (ans: any) => ans.selectedOption !== QUICK_SCAN_KEY
    },
    {
      type: 'number',
      name: 'burstTotal',
      message: (ans: any) => ans.selectedOption === DEEP_STRESS_ALL_KEY
        ? 'Jumlah Panggilan per Model (misal: 3-5 - cepat & hemat kuota):'
        : 'Total Burst Request (jumlah panggilan):',
      default: (ans: any) => ans.selectedOption === DEEP_STRESS_ALL_KEY ? 3 : (defaults.burstTotal || 20),
      validate: (val: number) => val > 0 || 'Harus lebih dari 0',
      when: (ans: any) => ans.selectedOption !== QUICK_SCAN_KEY
    },
    {
      type: 'number',
      name: 'concurrency',
      message: 'Konkurensi Paralel (jumlah worker bersamaan):',
      default: defaults.concurrency || 5,
      validate: (val: number) => val > 0 || 'Harus lebih dari 0',
      when: (ans: any) => ans.selectedOption !== QUICK_SCAN_KEY
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
      default: (ans: any) => {
        if (ans.selectedOption === QUICK_SCAN_KEY) return 'reports/health-scan-report.json';
        if (ans.selectedOption === DEEP_STRESS_ALL_KEY) return 'reports/all-models-report.json';
        return 'reports/benchmark-result.json';
      },
      when: (ans: any) => ans.saveReport
    }
  ]);

  const isQuickScan = testAnswers.selectedOption === QUICK_SCAN_KEY;
  const isDeepStressAll = testAnswers.selectedOption === DEEP_STRESS_ALL_KEY;
  const isAll = isQuickScan || isDeepStressAll;

  const targetModel = isAll
    ? availableModelList[0]
    : testAnswers.selectedOption === CUSTOM_MODEL_KEY
      ? testAnswers.customModel
      : testAnswers.selectedOption;

  return {
    url: connectionAnswers.url,
    apiKey: connectionAnswers.apiKey,
    model: targetModel,
    burstTotal: isQuickScan ? 1 : (testAnswers.burstTotal || 15),
    concurrency: isQuickScan ? 4 : (testAnswers.concurrency || 5),
    mode: isQuickScan ? 'rpm' : (testAnswers.mode as BenchmarkMode || 'rpm'),
    timeoutMs: defaults.timeoutMs || 25000,
    stream: defaults.stream || false,
    exportPath: testAnswers.exportPath,
    allModels: isAll,
    modelList: availableModelList,
    scanMode: isQuickScan ? 'quick-scan' : isDeepStressAll ? 'deep-stress' : 'single-model'
  };
}

async function runMultiModelBenchmark(config: BenchmarkConfig) {
  const modelsToTest = config.modelList && config.modelList.length > 0
    ? config.modelList
    : POPULAR_MODEL_PRESETS;

  const isQuickScan = config.scanMode === 'quick-scan';

  console.log('\n' + chalk.bold.cyan('╔═══════════════════════════════════════════════════════════╗'));
  if (isQuickScan) {
    console.log(chalk.bold.green('║   🩺 QUICK HEALTH SCAN: DIAGNOSTIK MODEL HIDUP / MATI     ║'));
  } else {
    console.log(chalk.bold.yellow('║   💥 DEEP STRESS TEST: PENGUJIAN LIMIT SELURUH MODEL      ║'));
  }
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝'));
  console.log(chalk.gray(`Target URL     : `) + chalk.white.bold(config.url));
  console.log(chalk.gray(`Total Models   : `) + chalk.yellow.bold(modelsToTest.length.toString()) + chalk.gray(` models`));
  console.log(chalk.gray(`Method         : `) + (isQuickScan ? chalk.green.bold('1 Probe per Model (Paralel Cepat)') : chalk.yellow.bold(`${config.burstTotal} Requests per Model (Burst)`)));
  console.log(chalk.gray(`Test Mode      : `) + chalk.magenta.bold(config.mode.toUpperCase()));
  console.log('─'.repeat(60) + '\n');

  const multiReport: MultiModelBenchmarkReport = {
    timestamp: new Date().toISOString(),
    routerUrl: config.url,
    scanMode: isQuickScan ? 'quick-scan' : 'deep-stress',
    totalModelsTested: modelsToTest.length,
    healthyModelsCount: 0,
    rateLimitedCount: 0,
    failedModelsCount: 0,
    activeModelsList: [],
    deadModelsList: [],
    models: []
  };

  const spinner = ora({
    text: chalk.cyan(`Memulai pemindaian ${modelsToTest.length} model...`),
    color: 'yellow'
  }).start();

  let completedModels = 0;

  // Function to benchmark a single model
  const benchmarkOneModel = async (modelName: string): Promise<any> => {
    const singleConfig: BenchmarkConfig = {
      ...config,
      model: modelName,
      burstTotal: isQuickScan ? 1 : config.burstTotal,
      concurrency: isQuickScan ? 1 : config.concurrency
    };

    const engine = new StressTestEngine(singleConfig);
    const results = await engine.run();

    const total = results.length;
    const successCount = results.filter(r => r.statusCode === 200).length;
    const rateLimitCount = results.filter(r => r.statusCode === 429).length;
    const errorCount = results.filter(r => r.statusCode !== 200 && r.statusCode !== 429).length;
    const fallbackCount = results.filter(r => r.isFallback).length;

    const validLatencies = results.filter(r => r.statusCode === 200).map(r => r.latencyMs);
    const avgLatencyMs = validLatencies.length > 0
      ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
      : 0;

    let status: ModelHealthStatus = 'HEALTHY';
    let note: string | undefined;

    if (rateLimitCount > 0) {
      status = 'RATE_LIMITED';
      note = `Rate Limit 429 (${rateLimitCount}/${total} rejected)`;
    } else if (successCount === total) {
      if (fallbackCount > 0) {
        status = 'FALLBACK';
        const fallbackInfo = results.find(r => r.fallbackInfo)?.fallbackInfo || 'Swapped';
        note = `Fallback triggered (${fallbackInfo})`;
      } else {
        status = 'HEALTHY';
        note = 'All OK';
      }
    } else {
      status = 'FAILED';
      const sampleErr = results.find(r => r.error)?.error || 'Dead / Inactive';
      note = sampleErr.slice(0, 45);
    }

    completedModels++;
    spinner.text = `[${completedModels}/${modelsToTest.length}] Memindai: ${chalk.bold(modelName)} | ` +
      `${chalk.green('Aktif: ' + multiReport.healthyModelsCount)} | ` +
      `${chalk.red('Mati: ' + multiReport.failedModelsCount)}`;

    return {
      model: modelName,
      totalRequests: total,
      successCount,
      rateLimitCount,
      errorCount,
      avgLatencyMs,
      status,
      note
    };
  };

  // Run with concurrency worker queue for speed
  const parallelWorkerLimit = isQuickScan ? 4 : 2;
  const queue = [...modelsToTest];
  const workers: Promise<void>[] = [];

  const worker = async () => {
    while (queue.length > 0) {
      const nextModel = queue.shift();
      if (!nextModel) break;
      const modelResult = await benchmarkOneModel(nextModel);

      if (modelResult.status === 'HEALTHY' || modelResult.status === 'FALLBACK') {
        multiReport.healthyModelsCount++;
        multiReport.activeModelsList.push(modelResult.model);
      } else if (modelResult.status === 'RATE_LIMITED') {
        multiReport.rateLimitedCount++;
      } else {
        multiReport.failedModelsCount++;
        multiReport.deadModelsList.push({
          model: modelResult.model,
          error: modelResult.note || 'Failed'
        });
      }

      multiReport.models.push(modelResult);
    }
  };

  for (let w = 0; w < Math.min(parallelWorkerLimit, modelsToTest.length); w++) {
    workers.push(worker());
  }

  await Promise.all(workers);

  spinner.succeed(chalk.green(`Pemindaian selesai: ${modelsToTest.length} model telah dievaluasi.`));

  // Sort report models to match original order
  multiReport.models.sort((a, b) => modelsToTest.indexOf(a.model) - modelsToTest.indexOf(b.model));

  BenchmarkReporter.printMultiModelSummary(multiReport, config.exportPath);
}

async function runSingleModelBenchmark(config: BenchmarkConfig) {
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
      exportPath: opts.export,
      allModels: Boolean(opts.allModels || opts.quickScan),
      scanMode: opts.quickScan ? 'quick-scan' : opts.allModels ? 'deep-stress' : undefined
    });
  } else {
    const isQuickScan = Boolean(opts.quickScan);
    const isAll = isQuickScan || Boolean(opts.allModels);

    let modelList: string[] | undefined;
    if (isAll) {
      const fetched = await fetchRouterModels(opts.url, opts.key);
      modelList = fetched.length > 0 ? fetched : POPULAR_MODEL_PRESETS;
    }

    config = {
      url: opts.url,
      apiKey: opts.key,
      model: opts.model,
      burstTotal: isQuickScan ? 1 : parseInt(opts.burst, 10),
      concurrency: isQuickScan ? 4 : parseInt(opts.concurrency, 10),
      mode: (opts.mode.toLowerCase() === 'tpm' ? 'tpm' : 'rpm') as BenchmarkMode,
      timeoutMs: parseInt(opts.timeout, 10),
      stream: Boolean(opts.stream),
      exportPath: opts.export,
      allModels: isAll,
      modelList,
      scanMode: isQuickScan ? 'quick-scan' : opts.allModels ? 'deep-stress' : 'single-model'
    };
  }

  if (config.allModels) {
    await runMultiModelBenchmark(config);
  } else {
    await runSingleModelBenchmark(config);
  }
}

main().catch((err) => {
  console.error(chalk.red.bold('\nFatal Error:'), err.message || err);
  process.exit(1);
});
