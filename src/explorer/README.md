# Bounded financial effect exploration

This dependency-free, browser-compatible module explores authored finite plans
against **the actual v3 assurance reducer**. The proposer is scripted, the evidence
is synthetic and all effects are local simulation events. This is neither a live
LLM evaluation nor a competitor benchmark or formal proof.

```js
import {
  scenarioCatalog, createScenario, explorePlan, repairPlan,
  compareScenario, verifyExplorationPacket,
} from './src/explorer/index.mjs';
const comparison = await compareScenario('stale-source');
const packet = await explorePlan('concurrent-credit', {
  mode: 'guarded',
  bounds: {maxDepth: 12, maxStates: 2000, maxTransitions: 6000, maxTimeMs: 1500},
});
console.log(packet.status, await verifyExplorationPacket(packet));
```

## What is explored

A scenario contains `initialState`, `initialNow`, `agents:[{id,actor,steps}]`,
`goal` and fixed `properties`. Each agent's steps preserve program order. Optional
`after:[stepId]` dependencies express explicit scheduling constraints. BFS explores
every enabled interleaving; it does not perform partial-order reduction.

Operations are:

- `check`: run a real reducer command speculatively and cache the result/events.
- `commit`: propose the cached command under the same actor.
- `command` / `atomic`: run an actual current-state reducer command.
- `advanceTime`: an explicit trusted simulation-clock step.

The intentionally naive teaching mode commits previously cached reducer events,
rebased onto the current event sequence, without current revalidation. This is a
deliberate broken boundary, not the production reducer. The guarded mode always
calls the actual reducer against the current state. Both modes receive precisely
the same plan, steps and enabled schedules. No credit math or amendment economics
is reimplemented. Before any naive effect, the current reducer is also queried as
an oracle, making a rejected-current-command plus committed cached event an
observable unauthorized local effect. Conservation is independently inspected
through `validateWorkspace`. Merely rejecting an attempt is a successful boundary,
not an invariant failure. Preparing a claim is an action event, not money movement.

BFS retains the shortest unsafe-effect prefix. Full workspace/event history,
program counters, clock, cached checks and observation history enter canonical
state deduplication; equal balances alone never merge histories. No hash collision
can merge states. For two agents with two ordered steps each, exactly six complete
schedules are explored. Counts are explored transition/prefix counts rather than
independent statistical samples. Event order can matter even when balances agree.

Hard bounds cover depth, discovered states, transitions and wall time. Any cutoff
sets `stats.inconclusive:true` and `exhaustiveWithinBounds:false`. A found witness
remains valid on a truncated search, but truncation cannot establish absence of
other failures. Exhaustive means the supplied finite plan's enabled schedules were
fully explored; it does not generalize to other events, amounts, tools or systems.

## Packets and verification

`explorePlan` returns an async JSON-safe packet:

- `status`: `unsafe_effect_found`, `no_unsafe_effect_within_bounds`, or `inconclusive`.
- `shortestWitness`: schedule, actual per-step effects, before/after projections,
  reducer-oracle results, final full workspace and unsafe-effect records.
- `sameScheduleGuardedReplay`: replay of the exact naive witness schedule through
  guarded execution, for a paired teaching comparison.
- `guardedRejection`, `completionTrace`: retained rejection/completion examples.
- `stats`: bounds, counts, unauthorized-effect transitions, rejected-effect
  attempts, committed transitions, frontier and cutoff status.
- `goalCompletion`: completed, safely completed and blocked/incomplete terminal
  schedule counts. These report utility separately from unsafe effects.
- `digest`: SHA-256 over canonical packet content (Web Crypto).

`verifyExplorationPacket` validates the digest/property version, independently
replays retained schedules from the supplied initial workspace, compares every
trace/state/effect, and reruns the bounded search to check shortestness and counts.
For a wall-time-truncated search it deterministically reproduces the exact BFS
prefix using the recorded expanded-state count, then compares every report field,
trace and goal count. It never trusts a cutoff report merely because its digest
was recomputed. Custom plans can be explored and verified as supplied premises;
verification does not authenticate those premises or grant their actors authority
in an external system. A digest detects modification;
it is not a signature, authenticity evidence, or trust in the supplied premises.

## Explicit repairs

`repairPlan` returns a new scenario with an explanation for unmodified catalog
fixtures only; unknown or edited custom plans return `null`. `compareScenario`
then returns `repair:null` and an actionable `repairReason`. It never silently
substitutes an unrelated template or changes a workspace behind the reducer's back.

- Credit: preserve both distinct allocation commands and request/allocation IDs.
  Atomically check capacity and commit each through the actual reducer. The first
  allocates USD 900; the other is rejected. No intent merging or deduplication is
  performed, and no extra capacity is manufactured.
- Source change: wait for the existing fixture update, have the analyst propose
  anew, have a distinct finance approver approve, then commit with current checks.
- Competing amendments: a distinct fixture finance approver explicitly dismisses
  the rival with a retained reason, then new proposal, approval and execution.
- Deadline: atomically recheck at commitment while leaving both adversarial clock
  orders eligible. One order completes; the expired order is blocked. This reports
  partial completion, not a universal repair. No deadline or external ordering is
  changed.
- Benign: use the atomic current-state reducer directly.

The approver fixture's availability is a stated assumption. These examples do not
let an executor approve its own action, synthesize vendor evidence, or promise
completion if new unmodeled updates arrive.

```sh
node --test src/explorer/*.test.mjs
node scripts/verify-exploration.mjs
node scripts/verify-exploration.mjs --write /tmp/exploration.json --scenario stale-source --mode naive
node scripts/verify-exploration.mjs --check /tmp/exploration.json
```
