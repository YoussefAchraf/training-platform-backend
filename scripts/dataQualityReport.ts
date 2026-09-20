import 'dotenv/config';
import { Pool } from 'pg';
import { collectDataQualityFindings } from '../src/infrastructure/database/dataQuality';

async function main() {
  const connectionString = process.env.REPORT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Set REPORT_DATABASE_URL (or DATABASE_URL).');
    process.exitCode = 2;
    return;
  }
  const strict = process.argv.includes('--strict');
  const pool = new Pool({ connectionString });
  try {
    const findings = await collectDataQualityFindings(pool);
    console.log('Data quality report (read-only; nothing is modified)\n');
    for (const finding of findings) {
      const marker = finding.count === 0 ? 'ok    ' : finding.severity.padEnd(7);
      const examples = finding.count > 0 ? `  e.g. ids ${finding.exampleIds.join(', ')}` : '';
      console.log(`${marker} ${String(finding.count).padStart(5)}  ${finding.code}${examples}`);
      if (finding.count > 0) console.log(`                 ${finding.description}`);
    }
    const problems = findings.filter((f) => f.severity === 'problem' && f.count > 0);
    console.log(problems.length === 0 ? '\nNo structural problems.' : `\n${problems.length} structural problem(s) found.`);
    if (strict && problems.length > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Report failed:', err.message);
  process.exitCode = 1;
});
