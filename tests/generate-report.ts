/**
 * Test report generator
 * Reads test-report.json and produces a human-readable HTML + Markdown report
 */
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  failureMessages?: string[];
}

interface TestSuite {
  name: string;
  tests: TestResult[];
}

interface VitestJsonReport {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numSkippedTests: number;
  startTime: number;
  success: boolean;
  testResults: {
    name: string;
    status: string;
    assertionResults: {
      fullName: string;
      status: string;
      title: string;
      duration: number;
      failureMessages: string[];
      ancestorTitles: string[];
    }[];
  }[];
}

function generateReport() {
  const reportPath = path.join(process.cwd(), 'test-report.json');

  if (!fs.existsSync(reportPath)) {
    console.error('test-report.json not found. Run tests first with: pnpm vitest run');
    process.exit(1);
  }

  const raw = fs.readFileSync(reportPath, 'utf-8');
  const report: VitestJsonReport = JSON.parse(raw);

  const totalTests = report.numTotalTests;
  const passed = report.numPassedTests;
  const failed = report.numFailedTests;
  const skipped = report.numSkippedTests || 0;
  const duration = ((Date.now() - report.startTime) / 1000).toFixed(2);
  const passRate = totalTests > 0 ? ((passed / totalTests) * 100).toFixed(1) : '0';

  // ── Generate Markdown Report ──
  let md = `# Test Report — Snackoh Bakers Management System\n\n`;
  md += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**Framework:** Vitest 4.x\n`;
  md += `**Environment:** Node.js ${process.version}\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| Total Tests | ${totalTests} |\n`;
  md += `| Passed | ${passed} |\n`;
  md += `| Failed | ${failed} |\n`;
  md += `| Skipped | ${skipped} |\n`;
  md += `| Pass Rate | ${passRate}% |\n`;
  md += `| Test Suites | ${report.numTotalTestSuites} |\n`;
  md += `| Status | ${report.success ? 'PASS' : 'FAIL'} |\n\n`;

  md += `## Test Suites\n\n`;

  for (const suite of report.testResults) {
    const suiteName = path.basename(suite.name);
    const suitePass = suite.assertionResults.every(t => t.status === 'passed');
    md += `### ${suitePass ? '[PASS]' : '[FAIL]'} ${suiteName}\n\n`;

    // Group by ancestor (describe block)
    const groups: Record<string, typeof suite.assertionResults> = {};
    for (const test of suite.assertionResults) {
      const group = test.ancestorTitles.join(' > ') || 'Root';
      if (!groups[group]) groups[group] = [];
      groups[group].push(test);
    }

    for (const [group, tests] of Object.entries(groups)) {
      md += `**${group}**\n\n`;
      md += `| Test | Status | Duration |\n|---|---|---|\n`;
      for (const test of tests) {
        const icon = test.status === 'passed' ? 'PASS' : test.status === 'failed' ? 'FAIL' : 'SKIP';
        md += `| ${test.title} | ${icon} | ${test.duration}ms |\n`;
      }
      md += `\n`;
    }

    // Show failures
    const failures = suite.assertionResults.filter(t => t.status === 'failed');
    if (failures.length > 0) {
      md += `**Failures:**\n\n`;
      for (const f of failures) {
        md += `- **${f.title}**\n`;
        for (const msg of f.failureMessages) {
          md += `  \`\`\`\n  ${msg.substring(0, 500)}\n  \`\`\`\n`;
        }
      }
      md += `\n`;
    }
  }

  md += `## Modules Covered\n\n`;
  md += `| Module | Description |\n|---|---|\n`;
  md += `| db-utils | camelCase/snake_case conversion utilities |\n`;
  md += `| supabase-crud | Generic CRUD helpers (fetch, insert, update, delete, upsert) |\n`;
  md += `| user-permissions | Role-based access control & route permissions |\n`;
  md += `| products | Product catalog, search, filtering |\n`;
  md += `| utils | CSS class name merger (cn) |\n`;
  md += `| audit-logger | Compliance audit trail logging |\n`;
  md += `| api-routes | API endpoint validation (auth, mpesa, distance) |\n`;
  md += `| module-crud-schemas | Schema validation for 18 database modules |\n`;
  md += `| cart-context | Shopping cart state management |\n`;

  // ── Generate HTML Report ──
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report — Snackoh Bakers</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #1a1a1a; margin-bottom: 8px; font-size: 28px; }
    h2 { color: #333; margin: 24px 0 12px; font-size: 22px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; }
    h3 { color: #555; margin: 16px 0 8px; font-size: 18px; }
    .meta { color: #666; margin-bottom: 24px; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin: 24px 0; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .card .value { font-size: 36px; font-weight: bold; }
    .card .label { color: #666; font-size: 14px; margin-top: 4px; }
    .pass { color: #16a34a; }
    .fail { color: #dc2626; }
    .skip { color: #ca8a04; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .status-badge.pass { background: #dcfce7; color: #16a34a; }
    .status-badge.fail { background: #fef2f2; color: #dc2626; }
    .status-badge.skip { background: #fefce8; color: #ca8a04; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #f8f9fa; text-align: left; padding: 10px 12px; font-size: 13px; color: #555; border-bottom: 2px solid #e0e0e0; }
    td { padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
    tr:hover { background: #f8f9fa; }
    .suite-header { background: white; border-radius: 8px; padding: 16px; margin: 16px 0 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .group-name { font-weight: 600; color: #444; margin: 12px 0 4px; font-size: 15px; }
    .failure-msg { background: #fef2f2; border-left: 3px solid #dc2626; padding: 8px 12px; margin: 4px 0; font-family: monospace; font-size: 12px; overflow-x: auto; border-radius: 0 4px 4px 0; }
    .overall { font-size: 20px; font-weight: bold; padding: 12px 24px; border-radius: 8px; display: inline-block; margin: 16px 0; }
    .overall.pass { background: #dcfce7; color: #16a34a; }
    .overall.fail { background: #fef2f2; color: #dc2626; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Report</h1>
    <p class="meta">Snackoh Bakers Management System &mdash; ${new Date().toISOString().split('T')[0]} &mdash; Vitest 4.x &mdash; Node.js ${process.version}</p>

    <div class="overall ${report.success ? 'pass' : 'fail'}">
      Overall: ${report.success ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}
    </div>

    <div class="summary">
      <div class="card"><div class="value">${totalTests}</div><div class="label">Total Tests</div></div>
      <div class="card"><div class="value pass">${passed}</div><div class="label">Passed</div></div>
      <div class="card"><div class="value fail">${failed}</div><div class="label">Failed</div></div>
      <div class="card"><div class="value skip">${skipped}</div><div class="label">Skipped</div></div>
      <div class="card"><div class="value">${passRate}%</div><div class="label">Pass Rate</div></div>
      <div class="card"><div class="value">${report.numTotalTestSuites}</div><div class="label">Test Suites</div></div>
    </div>

    <h2>Test Results by Suite</h2>`;

  for (const suite of report.testResults) {
    const suiteName = path.basename(suite.name);
    const suitePass = suite.assertionResults.every(t => t.status === 'passed');
    const suitePassCount = suite.assertionResults.filter(t => t.status === 'passed').length;
    const suiteTotal = suite.assertionResults.length;

    html += `
    <div class="suite-header">
      <h3><span class="status-badge ${suitePass ? 'pass' : 'fail'}">${suitePass ? 'PASS' : 'FAIL'}</span> ${suiteName} (${suitePassCount}/${suiteTotal})</h3>
    </div>`;

    const groups: Record<string, typeof suite.assertionResults> = {};
    for (const test of suite.assertionResults) {
      const group = test.ancestorTitles.join(' > ') || 'Root';
      if (!groups[group]) groups[group] = [];
      groups[group].push(test);
    }

    html += `<table><tr><th>Test</th><th>Group</th><th>Status</th><th>Duration</th></tr>`;
    for (const [group, tests] of Object.entries(groups)) {
      for (const test of tests) {
        const statusClass = test.status === 'passed' ? 'pass' : test.status === 'failed' ? 'fail' : 'skip';
        html += `<tr>
          <td>${test.title}</td>
          <td>${group}</td>
          <td><span class="status-badge ${statusClass}">${test.status.toUpperCase()}</span></td>
          <td>${test.duration}ms</td>
        </tr>`;
      }
    }
    html += `</table>`;

    const failures = suite.assertionResults.filter(t => t.status === 'failed');
    if (failures.length > 0) {
      for (const f of failures) {
        html += `<div class="failure-msg"><strong>${f.fullName}</strong><br/>${f.failureMessages.map(m => m.substring(0, 500).replace(/</g, '&lt;')).join('<br/>')}</div>`;
      }
    }
  }

  html += `
    <h2>Modules Covered</h2>
    <table>
      <tr><th>Module</th><th>Description</th></tr>
      <tr><td>db-utils</td><td>camelCase/snake_case conversion utilities</td></tr>
      <tr><td>supabase-crud</td><td>Generic CRUD helpers (fetch, insert, update, delete, upsert)</td></tr>
      <tr><td>user-permissions</td><td>Role-based access control & route permissions</td></tr>
      <tr><td>products</td><td>Product catalog, search, filtering</td></tr>
      <tr><td>utils</td><td>CSS class name merger (cn)</td></tr>
      <tr><td>audit-logger</td><td>Compliance audit trail logging</td></tr>
      <tr><td>api-routes</td><td>API endpoint validation (auth, mpesa, distance)</td></tr>
      <tr><td>module-crud-schemas</td><td>Schema validation for 18 database modules</td></tr>
      <tr><td>cart-context</td><td>Shopping cart state management</td></tr>
    </table>
  </div>
</body>
</html>`;

  // Write reports
  const mdPath = path.join(process.cwd(), 'test-report.md');
  const htmlPath = path.join(process.cwd(), 'test-report.html');

  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(htmlPath, html);

  console.log(`\nTest report generated:`);
  console.log(`  Markdown: ${mdPath}`);
  console.log(`  HTML:     ${htmlPath}`);
  console.log(`  JSON:     ${reportPath}`);
  console.log(`\nResults: ${passed}/${totalTests} passed (${passRate}%)`);
}

generateReport();
