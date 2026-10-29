#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical, createWorkspace, reduceWorkspace, evaluateWorkspace, validateWorkspace, isDate } from '../src/assurance/index.mjs';
import { verifyExportPacket } from '../server/service.mjs';

const NOTICE = 'Internal consistency only. This does not authenticate sources, actors, timestamps, feed completeness, or settlement. A person controlling the history can construct a new consistent record.';
const require = (condition, message) => { if (!condition) throw new Error(message); };
const iso = value => typeof value === 'string' && /T/.test(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

/** Rebuild complete commands, including commands that emit several atomic events. */
export function replayWorkspace(workspace, onCommit = () => {}) {
  require(workspace?.schemaVersion === 1 && typeof workspace.id === 'string' && Array.isArray(workspace.events) && workspace.revision === workspace.events.length, 'Workspace schema/revision is invalid.');
  require(workspace.events.length <= 10000, 'This bounded verifier supports at most 10,000 recorded domain events.');
  let replay = createWorkspace({ id: workspace.id, policy: workspace.basePolicy });
  let index = 0, commands = 0;
  onCommit(replay);
  while (index < workspace.events.length) {
    const first = workspace.events[index];
    require(typeof first.commandCanonical === 'string', `Event ${index + 1} has no original command.`);
    const command = JSON.parse(first.commandCanonical);
    require(canonical(command) === first.commandCanonical, `Event ${index + 1} contains a noncanonical command.`);
    const result = reduceWorkspace(replay, command, { actor: first.actor, now: first.observedAt });
    const emitted = result.state.revision - replay.revision;
    require(emitted > 0 && index + emitted <= workspace.events.length, `Event ${index + 1} does not correspond to a new complete command.`);
    require(canonical(result.state.events.slice(index)) === canonical(workspace.events.slice(index, index + emitted)), `Event ${index + 1} differs from deterministic command replay.`);
    replay = result.state; index += emitted; commands++;
    onCommit(replay);
  }
  require(canonical(replay) === canonical(workspace), 'The workspace snapshot differs from its original command history.');
  return { workspace: replay, commands, events: index };
}

export async function verifyAssurancePacket(packet) {
  try {
    if (packet?.format === 'truthful-server-evidence-v1') {
      const result = await verifyExportPacket(packet);
      require(result.valid, result.reason || 'Server audit verification failed.');
      const replay = replayWorkspace(packet.workspace);
      const invariant = validateWorkspace(packet.workspace, packet.projectionContext);
      require(invariant.valid, `Financial invariants failed: ${invariant.violations.join(' ')}`);
      return { valid: true, mode: 'local-sqlite', commands: replay.commands, events: replay.events, serverAuditEntries: packet.audit.length, notice: NOTICE };
    }
    require(packet?.format === 'truthful-assurance-packet-v1', 'Unsupported evidence-packet format.');
    require(['browser', 'server'].includes(packet.mode), 'Packet mode must be browser or server.');
    require(iso(packet.exportedAt), 'The export timestamp must be an ISO instant.');
    require(packet.actor && typeof packet.actor.id === 'string' && packet.actor.id.trim() && ['viewer', 'analyst', 'approver', 'executor', 'admin'].includes(packet.actor.role), 'The recorded local demo identity is invalid.');
    require(packet.view && isDate(packet.view.asOf) && iso(packet.view.knownAt), 'The exported view must retain explicit financial and knowledge dates.');
    const projectionContext = { asOf: packet.view.asOf, knownAt: packet.view.knownAt };
    const replay = replayWorkspace(packet.workspace);
    const expectedView = evaluateWorkspace(replay.workspace, projectionContext);
    require(canonical(expectedView) === canonical(packet.view), 'The outer projection differs from its workspace or replay dates.');
    const invariant = validateWorkspace(replay.workspace, projectionContext);
    require(invariant.valid, `Financial invariants failed: ${invariant.violations.join(' ')}`);
    require(canonical(invariant) === canonical(packet.invariantCheck), 'The recorded invariant result differs from the recomputed result.');
    let serverAuditEntries = 0;
    if (packet.mode === 'server') {
      require(packet.serverRecord?.format === 'truthful-server-evidence-v1', 'Server-mode export is missing its server evidence record.');
      const result = await verifyExportPacket(packet.serverRecord);
      require(result.valid, result.reason || 'Server audit verification failed.');
      require(canonical(packet.workspace) === canonical(packet.serverRecord.workspace), 'Outer and server workspace snapshots differ.');
      require(packet.serverRecord.projectionContext?.asOf === projectionContext.asOf && iso(packet.serverRecord.projectionContext?.knownAt) && new Date(packet.serverRecord.projectionContext.knownAt).toISOString() === new Date(projectionContext.knownAt).toISOString(), 'Outer and server projection dates differ.');
      require(canonical(packet.view) === canonical(packet.serverRecord.view), 'Outer and server financial projections differ.');
      serverAuditEntries = packet.serverRecord.audit.length;
    } else require(!Object.hasOwn(packet, 'serverRecord'), 'A browser-mode packet cannot claim a server evidence record.');
    return { valid: true, mode: packet.mode, commands: replay.commands, events: replay.events, serverAuditEntries, asOf: projectionContext.asOf, knownAt: projectionContext.knownAt, notice: NOTICE };
  } catch (error) { return { valid: false, reason: error.message || 'Evidence packet could not be verified.', notice: NOTICE }; }
}

async function main() {
  const args = process.argv.slice(2), json = args.includes('--json');
  const files = args.filter(value => value !== '--json');
  if (files[0] === '--help') {
    console.log('Usage: node scripts/verify-assurance-packet.mjs <downloaded-evidence.json> [--json]\nAccepts browser/server assurance exports and raw server evidence packets. No external authenticity claim.');
    return;
  }
  try {
    require(files.length === 1, 'Usage: node scripts/verify-assurance-packet.mjs <downloaded-evidence.json> [--json]');
    const size = (await stat(files[0])).size;
    require(size <= 25 * 1024 * 1024, 'Use an evidence packet smaller than 25 MB.');
    const result = await verifyAssurancePacket(JSON.parse(await readFile(files[0], 'utf8')));
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(result.valid ? `VALID: ${result.mode}; ${result.events} domain events across ${result.commands} complete commands; ${result.serverAuditEntries} server audit entries.` : `INVALID: ${result.reason}`);
      console.log(result.notice);
    }
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    if (json) console.log(JSON.stringify({ valid: false, reason: error.message, notice: NOTICE }, null, 2));
    else console.error(`INVALID: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
