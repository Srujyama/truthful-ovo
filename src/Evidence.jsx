import React, { useEffect, useRef } from 'react';
import { ArrowRight, Download, FileText, Play, X } from 'lucide-react';
import { sources } from './content.js';

function useDialog(onClose) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const notifyClose = () => {
      if (!dialog.open) onCloseRef.current();
    };
    document.body.style.overflow = 'hidden';
    dialog.addEventListener('close', notifyClose);
    dialog.showModal();
    return () => {
      dialog.removeEventListener('close', notifyClose);
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const close = () => dialogRef.current?.close();
  const onCancel = (event) => {
    event.preventDefault();
    close();
  };
  const onBackdropClick = (event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom) close();
  };

  return { dialogRef, close, onCancel, onBackdropClick };
}

function downloadSource(item) {
  const body = [
    'TRUTHFUL — FICTIONAL PROTOTYPE DOCUMENT',
    'Illustrative vendor, account, amounts, and evidence. No live integration.',
    '',
    item.title,
    `${item.kind} | ${item.vendor} | Acme Labs`,
    item.label,
    item.date,
    '',
    ...item.paragraphs.flatMap((paragraph) => [paragraph, '']),
    ...item.facts.map(([label, value]) => `${label}: ${value}`),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EvidenceDialog({ sourceId, onClose }) {
  const { dialogRef, close, onCancel, onBackdropClick } = useDialog(onClose);
  const item = sources[sourceId];

  return (
    <dialog
      ref={dialogRef}
      className="evidence-dialog"
      aria-labelledby="evidence-title"
      onCancel={onCancel}
      onClick={onBackdropClick}
    >
      <div className="drawer-head">
        <span><FileText size={17} aria-hidden="true" /> Source evidence</span>
        <button type="button" className="icon-button" aria-label="Close source evidence" onClick={close}>
          <X size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="drawer-body">
        {item ? (
          <>
            <div className="source-meta"><span>{item.kind}</span><span>Illustrative document</span></div>
            <h2 id="evidence-title">{item.title}</h2>
            <div className="source-byline"><p>{item.label}</p><p>{item.date}</p></div>
            <article className="paper-document" aria-label={`${item.title} contents`}>
              <div className="paper-vendor"><strong>{item.vendor}</strong><span>Acme Labs</span></div>
              {item.paragraphs.map((paragraph, index) => (
                <p key={index} className={index === item.highlight ? 'highlighted' : undefined}>
                  {paragraph}
                </p>
              ))}
              <dl className="source-facts">
                {item.facts.map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            </article>
            <p className="source-note">
              The highlighted passage supports the finding in your case. This source is part of the fictional Truthful prototype.
            </p>
          </>
        ) : (
          <>
            <h2 id="evidence-title">Source unavailable</h2>
            <p>This example has no linked document. Return to the case to select another source.</p>
          </>
        )}
      </div>
      <div className="drawer-footer">
        {item && (
          <button type="button" className="button secondary" onClick={() => downloadSource(item)}>
            <Download size={16} aria-hidden="true" /> Download source
          </button>
        )}
        <button type="button" className="button primary" onClick={close}>
          Back to case <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </dialog>
  );
}

const guideSteps = [
  ['0:00', 'Start with the promise', 'Open Nimbus Cloud’s agreement. A 99.9% uptime commitment includes service credits.'],
  ['0:25', 'Trigger the outage', 'Replay nine hours of covered downtime. Truthful calculates the $2,000 claim and shows its evidence.'],
  ['0:50', 'Approve, then catch the condition', 'Review the claim, approve it, and reveal the vendor’s renewal condition. Preserve the original terms.'],
  ['1:20', 'Follow the money', 'Receive the credit memo, then apply it. Only the application increases verified savings.'],
  ['1:40', 'Show the same idea elsewhere', 'Switch to Pipeline CRM: $2,400 promised, $900 applied, $1,500 outstanding. Email and agent promises follow the same path.'],
];

export function GuideDialog({ onClose }) {
  const { dialogRef, close, onCancel, onBackdropClick } = useDialog(onClose);
  return (
    <dialog
      ref={dialogRef}
      className="guide-dialog"
      aria-labelledby="guide-title"
      onCancel={onCancel}
      onClick={onBackdropClick}
    >
      <div className="drawer-head">
        <span><Play size={17} aria-hidden="true" /> Recording guide</span>
        <button type="button" className="icon-button" aria-label="Close recording guide" onClick={close}>
          <X size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="drawer-body">
        <h2 id="guide-title">A promise. A gap. Proof.</h2>
        <p className="guide-intro">One complete story, in two minutes. Use the demo controls to move through each event at your own pace.</p>
        <ol className="guide-steps">
          {guideSteps.map(([time, title, description]) => (
            <li key={time}>
              <span className="guide-time">{time}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </li>
          ))}
        </ol>
        <p className="guide-note">
          This prototype uses prepared source interpretation and real calculations. Outages, vendor replies, and credits are simulated. No external messages are sent.
        </p>
      </div>
      <div className="drawer-footer">
        <button type="button" className="button primary" onClick={close}>
          Start walkthrough <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </dialog>
  );
}
