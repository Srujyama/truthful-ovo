#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {compareScenario,explorePlan,scenarioCatalog,verifyExplorationPacket} from '../src/explorer/index.mjs';
const args=process.argv.slice(2);
if(args.includes('--help')){
 console.log('Usage: node scripts/verify-exploration.mjs [--scenario ID] [--mode naive|guarded] [--write FILE] [--check FILE]\nDefault: explore all authored scenarios and verify guarded and repaired completion. --write exports one portable exploration packet (default stale-source, naive). --check independently replays and verifies a packet. No LLM or external service calls.');
}else if(args.includes('--check')){
 const path=args[args.indexOf('--check')+1];const packet=JSON.parse(await readFile(path,'utf8'));const result=await verifyExplorationPacket(packet);console.log(JSON.stringify(result,null,2));if(!result.valid)process.exitCode=1;
}else if(args.includes('--write')){
 const value=key=>args.includes(key)?args[args.indexOf(key)+1]:null;
 const packet=await explorePlan(value('--scenario')||'stale-source',{mode:value('--mode')||'naive'});await writeFile(value('--write'),JSON.stringify(packet,null,2)+'\n');const result=await verifyExplorationPacket(packet);console.log(JSON.stringify({file:value('--write'),digest:packet.digest,...result},null,2));if(!result.valid)process.exitCode=1;
}else{
 const rows=[];let valid=true;for(const s of scenarioCatalog){const c=await compareScenario(s.id);for(const p of [c.naive,c.guarded,c.repair.report]){const r=await verifyExplorationPacket(p);if(!r.valid){valid=false;console.error(s.id,r.errors);}}
 const passed=c.guarded.shortestWitness===null&&c.repair.report.goalCompletion.safeCompletedSchedules>0&&c.repair.report.stats.exhaustiveWithinBounds;if(!passed)valid=false;
 rows.push({scenario:s.id,passed,naiveUnsafeEffect:Boolean(c.naive.shortestWitness),shortestUnsafeSteps:c.naive.shortestWitness?.schedule.length||null,guardedSchedules:c.guarded.stats.terminalSchedules,guardedUnsafeEffects:c.guarded.stats.unsafeSchedules,repairedSafeCompletions:c.repair.report.goalCompletion.safeCompletedSchedules});}
 console.log(JSON.stringify({valid,label:'Authored scripted teaching harness comparison; not a competitor or LLM benchmark',scenarios:rows},null,2));if(!valid)process.exitCode=1;
}
