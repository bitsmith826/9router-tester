import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import { BenchmarkSummary, RecommendedCombo, RequestResult } from './types.js';
import { buildRecommendedCombos } from './classifier.js';

export class BenchmarkReporter {
  public static printHeader(summaryConfig: any) {
    console.log('\n' + chalk.bold.cyan('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║                     9ROUTER TESTER                        ║'));
    console.log(chalk.bold.cyan('║     Health Scan • Combo Recommender • Stress Test         ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝'));
    console.log(chalk.gray(`Target URL   : `) + chalk.white.bold(summaryConfig.url));
    console.log(chalk.gray(`Target Model : `) + chalk.yellow.bold(summaryConfig.model));
    console.log(chalk.gray(`Test Mode    : `) + chalk.magenta.bold(summaryConfig.mode.toUpperCase()));
    if (summaryConfig.maxTokens) {
      console.log(chalk.gray(`Max Tokens   : `) + chalk.cyan.bold(summaryConfig.maxTokens.toString()));
    }
    console.log(chalk.gray(`Total Burst  : `) + chalk.green.bold(summaryConfig.burstTotal) + chalk.gray(` requests`));
    console.log(chalk.gray(`Concurrency  : `) + chalk.blue.bold(summaryConfig.concurrency) + chalk.gray(` concurrent workers`));
    console.log(chalk.gray(`Streaming    : `) + (summaryConfig.stream ? chalk.green('Enabled') : chalk.gray('Disabled')));
    console.log('─'.repeat(60) + '\n');
  }

  public static printSummary(summary: BenchmarkSummary, results: RequestResult[]) {
    // 1. Core Metrics Table
    const overviewTable = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      colWidths: [26, 26],
      wordWrap: true,
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

    if (summary.tokenUsage) {
      overviewTable.push(
        ['Total Tokens Used', chalk.cyan.bold(summary.tokenUsage.totalTokens.toLocaleString())],
        ['Token Split (In/Out)', `${summary.tokenUsage.promptTokens.toLocaleString()} / ${summary.tokenUsage.completionTokens.toLocaleString()}`],
        ['Token Speed', chalk.green.bold(`${summary.tokenUsage.tokensPerSecond.toLocaleString()} tok/s (~${summary.tokenUsage.estimatedTpm.toLocaleString()} TPM)`)]
      );
    }

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
      colWidths: [9, 9, 9, 9, 9, 9, 9],
      wordWrap: true,
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

    // 2b. TTFT Table (if streaming benchmarked)
    if (summary.ttft) {
      const ttftTable = new Table({
        head: [
          chalk.cyan('Min TTFT'),
          chalk.cyan('Avg TTFT'),
          chalk.cyan('p50'),
          chalk.cyan('p90'),
          chalk.cyan('p95'),
          chalk.cyan('p99'),
          chalk.cyan('Max TTFT')
        ],
        colWidths: [9, 9, 9, 9, 9, 9, 9],
        wordWrap: true,
        style: { head: [], border: ['gray'] }
      });

      ttftTable.push([
        `${summary.ttft.min}ms`,
        chalk.bold(`${summary.ttft.avg}ms`),
        `${summary.ttft.p50}ms`,
        `${summary.ttft.p90}ms`,
        chalk.yellow.bold(`${summary.ttft.p95}ms`),
        `${summary.ttft.p99}ms`,
        chalk.red(`${summary.ttft.max}ms`)
      ]);

      console.log(chalk.bold.white('\n⚡ TIME TO FIRST TOKEN (TTFT - STREAMING)'));
      console.log(ttftTable.toString());
    }

    // 3. Smart Fallback Analysis
    if (summary.fallbackCount > 0) {
      console.log('\n' + chalk.yellow.bold('⚡ SMART FALLBACK DETECTED:'));
      console.log(
        chalk.yellow(
          `  Router automatically redirected ${summary.fallbackCount} requests to alternate provider models!`
        )
      );

      const modelTable = new Table({
        head: [chalk.yellow('Provider / Model Responded'), chalk.yellow('Request Count')],
        colWidths: [36, 16],
        wordWrap: true,
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
          `  Upstream provider / router quota limit was reached on ${summary.rateLimitCount} requests.`
        )
      );
      if (summary.rateLimitInfo?.retryAfter) {
        console.log(chalk.yellow(`  ⏱️  Retry-After Header : `) + chalk.white.bold(summary.rateLimitInfo.retryAfter));
      }
      if (summary.rateLimitInfo?.reset) {
        console.log(chalk.yellow(`  🔄 Rate Limit Reset   : `) + chalk.white.bold(summary.rateLimitInfo.reset));
      }
      if (summary.rateLimitInfo?.remaining) {
        console.log(chalk.yellow(`  📉 Remaining Quota    : `) + chalk.white.bold(summary.rateLimitInfo.remaining));
      }
      if (summary.rateLimitInfo?.message) {
        console.log(chalk.yellow(`  💬 Provider Message   : `) + chalk.white(summary.rateLimitInfo.message));
      }
      console.log(
        chalk.gray('  Tip: Check router dashboard or configure secondary fallback tier.')
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

  public static printMultiModelSummary(report: any, exportPath?: string) {
    console.log('\n' + chalk.bold.cyan('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║         ALL-MODELS ENDPOINT HEALTH & STRESS TEST          ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝'));
    console.log(chalk.gray(`Target URL           : `) + chalk.white.bold(report.routerUrl));
    console.log(chalk.gray(`Total Models Tested  : `) + chalk.yellow.bold(report.totalModelsTested.toString()));
    console.log('─'.repeat(60) + '\n');

    const table = new Table({
      head: [
        chalk.cyan.bold('Model Name'),
        chalk.cyan.bold('Status'),
        chalk.cyan.bold('Pass Rate'),
        chalk.cyan.bold('Latency')
      ],
      colWidths: [38, 12, 13, 10],
      wordWrap: true,
      chars: {
        'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
        'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
        'right': '', 'right-mid': '', 'middle': '  '
      },
      style: { 'padding-left': 0, 'padding-right': 0, head: [] }
    });

    table.push([
      chalk.gray('─'.repeat(38)),
      chalk.gray('─'.repeat(12)),
      chalk.gray('─'.repeat(13)),
      chalk.gray('─'.repeat(10))
    ]);

    for (const m of report.models) {
      let statusBadge = '';
      if (m.status === 'HEALTHY') {
        statusBadge = chalk.green.bold('OK (200)');
      } else if (m.status === 'FALLBACK') {
        statusBadge = chalk.yellow.bold('FALLBACK');
      } else if (m.status === 'RATE_LIMITED') {
        statusBadge = chalk.red.bold('429 LIMIT');
      } else {
        statusBadge = chalk.red.bold('DEAD');
      }

      const passRate = `${m.successCount}/${m.totalRequests} (${Math.round((m.successCount / m.totalRequests) * 100)}%)`;
      const passRateColor = m.successCount === m.totalRequests
        ? chalk.green(passRate)
        : m.successCount > 0
          ? chalk.yellow(passRate)
          : chalk.red(passRate);

      table.push([
        chalk.white(m.model),
        statusBadge,
        passRateColor,
        m.avgLatencyMs > 0 ? `${m.avgLatencyMs}ms` : chalk.gray('-')
      ]);
    }

    console.log(table.toString());

    console.log('\n' + chalk.bold.white('📊 ALL-MODELS TEST SUMMARY:'));
    console.log(chalk.green(`  ✔ Active & Working Models : ${report.healthyModelsCount} / ${report.totalModelsTested}`));
    if (report.rateLimitedCount > 0) {
      console.log(chalk.yellow(`  🚨 Rate-Limited Models    : ${report.rateLimitedCount}`));
    }
    if (report.failedModelsCount > 0) {
      console.log(chalk.red(`  ✖ Failed / Dead Models    : ${report.failedModelsCount}`));
    }

    // Copy-pasteable list for Cursor / Cline (Super Minimalist)
    if (report.activeModelsList && report.activeModelsList.length > 0) {
      console.log('\n' + chalk.bold.green('╔═══════════════════════════════════════════════════════════╗'));
      console.log(chalk.bold.green('║  📋 MODEL AKTIF (Copy-Paste ke Setting Cursor / Cline)    ║'));
      console.log(chalk.bold.green('╚═══════════════════════════════════════════════════════════╝'));
      console.log(chalk.white.bold(`  ${report.activeModelsList.join(', ')}\n`));
    }

    // Recommended 9Router Combos
    const activeWithLatency = report.models
      ? report.models
          .filter((m: any) => m.status === 'HEALTHY' || m.status === 'FALLBACK')
          .map((m: any) => ({ model: m.model, avgLatencyMs: m.avgLatencyMs }))
      : (report.activeModelsList || []).map((mod: string) => ({ model: mod, avgLatencyMs: 0 }));

    if (activeWithLatency.length > 0) {
      const combos = report.recommendedCombos || buildRecommendedCombos(activeWithLatency);
      report.recommendedCombos = combos;
      this.printRecommendedCombos(combos);
    }

    if (exportPath) {
      this.exportMultiModelToJson(exportPath, report);
    }
  }

  public static printRecommendedCombos(combos: RecommendedCombo[]) {
    if (!combos || combos.length === 0) return;

    console.log(chalk.bold.cyan('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║  💡 REKOMENDASI 9ROUTER COMBO (Copy-Paste ke Form Combo)  ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝'));

    for (const combo of combos) {
      console.log(`  ${combo.icon} ${chalk.bold.white('Combo :')} ${chalk.yellow.bold(combo.id)}`);
      console.log(`     ${chalk.bold.white('Model :')} ${chalk.cyan.bold(combo.modelChain.join(', '))}\n`);
    }
  }

  public static exportMultiModelToJson(exportPath: string, report: any) {
    try {
      const fullPath = path.resolve(exportPath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log('\n' + chalk.green(`✓ All-models report saved to: ${chalk.bold(fullPath)}`));
    } catch (err: any) {
      console.error(chalk.red(`\nFailed to save export file: ${err.message}`));
    }
  }
}
