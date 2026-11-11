// The foot of a ledger, as the shell's <Total> draws it, with one thing more:
// each figure carries its column's name, so the phone (where the column heads
// are gone) can print it beside the figure.
//
//   <Totals cells={[null, { title: 'Total' }, { label: 'They promised', value: '4,750.00', rule: 'double' }, …]} />

import React from 'react';
import { cx } from '../../shell/parts.jsx';

export default function Totals({ cells }) {
  return (
    <div className="bk-ltotal bk-rec-total" role="row">
      {cells.map((c, i) => {
        if (!c) return <span key={i} className="r-none" />;
        if (c.title) return <span key={i} className="is-label r-none" style={c.span ? { gridColumn: `span ${c.span}` } : undefined}>{c.title}</span>;
        return <span key={i} data-label={c.label} className={cx('is-num', c.owed && 'is-owed', c.rule && `r-${c.rule}`)}><b>{c.value}</b></span>;
      })}
    </div>
  );
}
