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

async function promptInteractiveWizard(defaults: Partial<BenchmarkConfig>): Promise<BenchmarkConfig> {
  console.log('\n' + chalk.cyan.bold('🧙 9ROUTER STRESS TEST - SETUP WIZARD'));
  console.log(chalk.gray('Configure your stress test parameters below:\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: '9Router Endpoint URL:',
      default: defaults.url || 'http://localhost:20128/v1',
      validate: (input: string) => input.trim().length > 0 || 'URL cannot be empty'
    },
    {
      type: 'input',
      name: 'apiKey',
      message: '9Router API Key:',
      default: defaults.apiKey || '9router'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Target AI Model:',
      default: defaults.model || 'claude-3-5-sonnet'
    },
    {
      type: 'list',
      name: 'mode',
      message: 'Testing Mode:',
      choices: [
        {
          name: 'RPM Mode (Token-efficient: 1 word prompt, 5 max_tokens to test request limit)',
          value: 'rpm'
        },
        {
          name: 'TPM Mode (Token-intensive: Large context payload to test token quota)',
          value: 'tpm'
        }
      ],
      default: defaults.mode || 'rpm'
    },
    {
      type: 'number',
      name: 'burstTotal',
      message: 'Total Burst Requests:',
      default: defaults.burstTotal || 20,
      validate: (val: number) => val > 0 || 'Must be greater than 0'
    },
    {
      type: 'number',
      name: 'concurrency',
      message: 'Concurrent Workers (Parallelism):',
      default: defaults.concurrency || 5,
      validate: (val: number) => val > 0 || 'Must be greater than 0'
    },
    {
      type: 'confirm',
      name: 'saveReport',
      message: 'Save detailed JSON report to file?',
      default: true
    },
    {
      type: 'input',
      name: 'exportPath',
      message: 'Report export path:',
      default: 'reports/benchmark-result.json',
      when: (ans: any) => ans.saveReport
    }
  ]);

  return {
    url: answers.url,
    apiKey: answers.apiKey,
    model: answers.model,
    burstTotal: answers.burstTotal,
    concurrency: answers.concurrency,
    mode: answers.mode as BenchmarkMode,
    timeoutMs: defaults.timeoutMs || 30000,
    stream: defaults.stream || false,
    exportPath: answers.exportPath
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
