// The test bench, for the engineers.
//
// Three tools on one ledger sheet, each trying to break the book and showing
// that the ledger says no:
//   Two clerks, one credit        every ordering of two competing programs   (./bench/Clerks.jsx)
//   Permission slips              a signed, one-use permission for one decision (./bench/Slips.jsx)
//   Nine ways it could go wrong   nine old tricks against a fresh copy       (./bench/Nine.jsx)
//
//   #/bench?tool=clerks | slips | trials
//   #/bench?a=<actionId>&iou=<commitmentId>   opens Permission slips on that decision
//
// A tool stays where it was left when you turn to another: a half-run race or a
// slip still counting down is there when you come back.

import React, { useRef } from 'react';
import { Filters, Sheet, SheetHead } from '../shell/parts.jsx';
import Clerks from './bench/Clerks.jsx';
import Slips from './bench/Slips.jsx';
import Nine from './bench/Nine.jsx';
import './bench.css';

const TOOLS = [
  { id: 'clerks', label: 'Two clerks, one credit', Tool: Clerks },
  { id: 'slips', label: 'Permission slips', Tool: Slips },
  { id: 'trials', label: 'Nine ways it could go wrong', Tool: Nine },
];

export default function Bench({ service, view, route, go, say, active }) {
  const q = route.query;
  const tool = TOOLS.some(t => t.id === q.tool) ? q.tool : q.a || q.iou ? 'slips' : 'clerks';
  const opened = useRef(new Set());
  opened.current.add(tool);
  if (!view) return null;

  return (
    <Sheet className="bk-bench">
      <SheetHead
        kicker="test bench"
        title={<>For engineers. <i>Try the book against its own rules.</i></>}
        lede="Race two clerks for one credit, use a permission slip twice, or run nine old tricks against the ledger. A refusal is the ledger working."
      >
        <div className="bk-bench-tools">
          <Filters items={TOOLS} value={tool} label="Which tool" onChange={id => go('bench', '', { tool: id, a: q.a, iou: q.iou }, { replace: true })} />
        </div>
      </SheetHead>

      {TOOLS.map(({ id, Tool }) => opened.current.has(id) && (
        <div key={id} hidden={tool !== id} inert={tool !== id ? true : undefined} className="bk-bench-tool">
          <Tool service={service} view={view} route={route} go={go} say={say} active={active && tool === id} />
        </div>
      ))}
    </Sheet>
  );
}
