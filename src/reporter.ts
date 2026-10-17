import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import { BenchmarkSummary, RequestResult } from './types.js';

export class BenchmarkReporter {
  public static printHeader(summaryConfig: any) {
    console.log('\n' + chalk.bold.cyan('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║            9ROUTER AI STRESS-TEST BENCHMARK               ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝'));
    console.log(chalk.gray(`Target URL   : `) + chalk.white.bold(summaryConfig.url));
    console.log(chalk.gray(`Target Model : `) + chalk.yellow.bold(summaryConfig.model));
    console.log(chalk.gray(`Test Mode    : `) + chalk.magenta.bold(summaryConfig.mode.toUpperCase()));
    console.log(chalk.gray(`Total Burst  : `) + chalk.green.bold(summaryConfig.burstTotal) + chalk.gray(` requests`));
    console.log(chalk.gray(`Concurrency  : `) + chalk.blue.bold(summaryConfig.concurrency) + chalk.gray(` concurrent workers`));
    console.log(chalk.gray(`Streaming    : `) + (summaryConfig.stream ? chalk.green('Enabled') : chalk.gray('Disabled')));
    console.log('─'.repeat(60) + '\n');
  }

  public static printSummary(summary: BenchmarkSummary, results: RequestResult[]) {
    // 1. Core Metrics Table
    const overviewTable = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      style: { head: [], border: ['gray'] }
    });

    overviewTable.push(
      ['Total Requests', chalk.bold(summary.totalRequests.toString())],
      ['Total Time', `${(summary.totalDurationMs / 1000).toFixed(2)} seconds`],
      ['Throughput', chalk.green.bold(`${summary.throughputRps} req/s`)],
      ['Success (200 OK)', summary.successCount > 0 ? chalk.green.bold(summary.successCount.toString()) : '0'],
      ['Rate Limits (429)', summary.rateLimitCount > 0 ? chalk.red.bold(summary.rateLimitCount.toString()) : chalk.gray('0')],
      ['Smart Fallbacks', summary.fallbackCount > 0 ? chalk.yellow.bold(summary.fallbackCount.toString()) : chalk.gray('0')],
      ['Timeouts', summary.timeoutCount > 0 ? chalk.red(summary.timeoutCount.toString()) : chalk.gray('0')],
      ['Server Errors (5xx)', summary.serverErrorCount > 0 ? chalk.red(summary.serverErrorCount.toString()) : chalk.gray('0')]
    );

    console.log(chalk.bold.white('\n📊 BENCHMARK OVERVIEW'));
    console.log(overviewTable.toString());

    // 2. Latency Table
    const latencyTable = new Table({
      head: [
        chalk.cyan('Min'),
        chalk.cyan('Avg'),
        chalk.cyan('p50'),
        chalk.cyan('p90'),
        chalk.cyan('p95'),
        chalk.cyan('p99'),
        chalk.cyan('Max')
      ],
      style: { head: [], border: ['gray'] }
    });

    latencyTable.push([
      `${summary.latencies.min}ms`,
      chalk.bold(`${summary.latencies.avg}ms`),
      `${summary.latencies.p50}ms`,
      `${summary.latencies.p90}ms`,
      chalk.yellow.bold(`${summary.latencies.p95}ms`),
      `${summary.latencies.p99}ms`,
      chalk.red(`${summary.latencies.max}ms`)
    ]);

    console.log(chalk.bold.white('\n⏱️  LATENCY PERCENTILES (200 OK)'));
    console.log(latencyTable.toString());

    // 3. Smart Fallback Analysis
    if (summary.fallbackCount > 0) {
      console.log('\n' + chalk.yellow.bold('⚡ SMART FALLBACK DETECTED:'));
      console.log(
        chalk.yellow(
          `  9Router automatically redirected ${summary.fallbackCount} requests to alternate provider models!`
        )
      );

      const modelTable = new Table({
        head: [chalk.yellow('Provider / Model Responded'), chalk.yellow('Request Count')],
        style: { head: [], border: ['gray'] }
      });

      for (const [mod, count] of Object.entries(summary.modelDistribution)) {
        modelTable.push([mod, count.toString()]);
      }
      console.log(modelTable.toString());
    }

    // 4. Rate Limit (429) Analysis
    if (summary.rateLimitCount > 0) {
      console.log('\n' + chalk.red.bold('🚨 RATE LIMIT DETECTED (HTTP 429):'));
      console.log(
        chalk.red(
          `  The upstream provider or 9Router quota limit was reached on ${summary.rateLimitCount} requests.`
        )
      );
      console.log(
        chalk.gray('  Tip: Check 9Router server logs or switch to secondary tier model.')
      );
    }

    // 5. Sample Errors if any
    const sampleErrors = results.filter(r => r.error).slice(0, 3);
    if (sampleErrors.length > 0) {
      console.log('\n' + chalk.red.bold('⚠️  SAMPLE ERROR MESSAGES:'));
      sampleErrors.forEach((err, idx) => {
        console.log(chalk.red(`  [${idx + 1}] Req #${err.id} (${err.statusCode}): ${err.error}`));
      });
    }

    // 6. JSON Export
    if (summary.config.exportPath) {
      this.exportToJson(summary.config.exportPath, summary, results);
    }
  }

  public static exportToJson(exportPath: string, summary: BenchmarkSummary, results: RequestResult[]) {
    try {
      const fullPath = path.resolve(exportPath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const reportData = {
        summary,
        results
      };

      fs.writeFileSync(fullPath, JSON.stringify(reportData, null, 2), 'utf-8');
      console.log('\n' + chalk.green(`✓ Detailed report saved to: ${chalk.bold(fullPath)}`));
    } catch (err: any) {
      console.error(chalk.red(`\nFailed to save export file: ${err.message}`));
    }
  }
}
