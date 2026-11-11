// One of the three papers that go in the tray. You type on it, paste onto it, or
// drop a text file on it; what you put there is what gets read, word for word.

import React, { useId, useRef, useState } from 'react';
import { cx } from '../../shell/parts.jsx';

const hasFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');

export default function Slot({ slot, value, says, onChange, onFiles }) {
  const id = useId();
  const picker = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={cx('bk-tray-slot', over && 'is-over', value.trim() && 'is-full')}
      data-slot={slot.source}
      onDragEnter={event => { if (hasFiles(event)) { event.preventDefault(); setOver(true); } }}
      onDragOver={event => { if (hasFiles(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOver(false); }}
      onDrop={event => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        onFiles([...event.dataTransfer.files], slot.key);
      }}
    >
      <label className="bk-tray-slot-head" htmlFor={id}>
        <b>{slot.title}</b>
        <span>{slot.said}</span>
      </label>
      <textarea
        id={id}
        className="bk-tray-slot-text"
        value={value}
        placeholder={slot.blank}
        wrap={slot.key === 'invoiceCsv' ? 'off' : 'soft'}
        spellCheck={false}
        autoComplete="off"
        maxLength={250000}
        aria-describedby={says ? `${id}-says` : undefined}
        aria-invalid={says ? true : undefined}
        onChange={event => onChange(slot.key, event.target.value)}
      />
      {says && <p id={`${id}-says`} className="bk-tray-slot-says" role="alert">{says}</p>}
      <div className="bk-tray-slot-foot">
        <button type="button" className="bk-link" onClick={() => picker.current?.click()}>Choose a file</button>
        {value !== '' && <button type="button" className="bk-link" onClick={() => onChange(slot.key, '')}>Take it out</button>}
        <input
          ref={picker}
          type="file"
          hidden
          tabIndex={-1}
          accept=".txt,.csv,.eml,text/plain,text/csv,message/rfc822"
          aria-label={`A file for ${slot.title.toLowerCase()}`}
          onChange={event => {
            const files = [...(event.target.files || [])];
            event.target.value = '';
            if (files.length) onFiles(files, slot.key);
          }}
        />
      </div>
    </div>
  );
}
