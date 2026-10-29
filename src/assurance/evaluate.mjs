import { runScenarios } from './scenarios.mjs';
const results=runScenarios();
const output={notice:'Authored synthetic scenario regressions, not held-out evaluation, formal verification, source completeness or settlement finality.',passed:results.filter(r=>r.passed).length,total:results.length,checksPassed:results.flatMap(r=>r.checks).filter(c=>c.passed).length,checksTotal:results.flatMap(r=>r.checks).length,scenarios:results.map(({id,name,passed,steps,checks})=>({id,name,passed,steps:steps.length,checks}))};
if(process.argv.includes('--json'))console.log(JSON.stringify(output,null,2));
else {console.log(output.notice);for(const result of output.scenarios)console.log(`${result.passed?'PASS':'FAIL'} ${result.id}: ${result.checks.filter(c=>c.passed).length}/${result.checks.length} checks`);console.log(`${output.passed}/${output.total} scenarios; ${output.checksPassed}/${output.checksTotal} authored checks.`);}
if(output.passed!==output.total)process.exitCode=1;
