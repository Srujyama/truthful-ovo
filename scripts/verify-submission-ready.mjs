import { readFile } from 'node:fs/promises';
const state = JSON.parse(await readFile(new URL('../docs/delivery.json',import.meta.url),'utf8'));
const missing = [];
if (state.driveRecordingVersion !== '3.0.0') missing.push('Record the final v3 recording URL on an accepted video host.');
if (!state.driveAnyoneWithLinkVerified) missing.push('Verify anyone-with-link playback on the Drive recording.');
if (!['technical','design'].includes(state.round1Track)) missing.push('Confirm the actual Round 1 track.');
if (typeof state.attendanceConfirmed !== 'boolean') missing.push('Obtain the team’s actual November 19 attendance answer.');
if (state.teamConsented !== true) missing.push('Obtain actual teammate agreement to the submission.');
if (!['runtime_connected','rules_only'].includes(state.runtimeAiDecision)) missing.push('Resolve the pending runtime-AI credential/direction choice.');
if (missing.length) {
  console.error('Submission is not ready:\n' + missing.map(item => `- ${item}`).join('\n'));
  process.exitCode = 1;
} else console.log('Recorded submission decisions are complete. Recheck public links and review all form statements before submitting.');
