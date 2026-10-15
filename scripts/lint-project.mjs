import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {auditHistoricalQA} from './qa/audit-historical-qa.mjs';
import {verifyProductionModuleBoundary} from './qa/verify-production-module-boundary.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try{
 const audit=await auditHistoricalQA({root});
 const boundary=await verifyProductionModuleBoundary({root});
 console.log(`Production module boundary: ${boundary.entry_points} app entries / ${boundary.module_inputs} JS/TS inputs; historical QA imports: ${boundary.historical_QA_inputs.length}.`);
 console.log(`Historical QA integrity: ${audit.files} immutable files verified. Captured raw diagnostics: ${audit.captured_historical_lint.errors} errors / ${audit.captured_historical_lint.warnings} warnings. Fresh diagnostic audit: npm run lint:archives -- --lint-report NEW_REPORT.json`);
 console.log('Product lint: current application, libraries, configuration and maintained QA scripts. Historical docs/qa records are checked separately above. Existing ESLint rules are unchanged.');
 const args=['.', '--ignore-pattern','dist','--ignore-pattern','.next','--ignore-pattern','docs/qa/**',...process.argv.slice(2)];
 const result=spawnSync(process.execPath,[path.join(root,'node_modules/eslint/bin/eslint.js'),...args],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.signal)process.kill(process.pid,result.signal);
 process.exitCode=result.status??1;
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1}
