// The book of IOUs: the first screen of Truthful.
//
//   import BookFront from './book/front/BookFront.jsx';
//   <BookFront service={assurance} onOpenCase={(commitmentId) => …} onGo={(page) => …} tabs={…} tools={…} />
//
// service      (required) the object the app's one useAssurance hook returns.
//              The parent calls the hook and passes it down; nothing under
//              src/book/front calls it. The book reads service.workspace through
//              selectors.mjs and sends everything a visitor does to
//              service.commands as one batch (commands.mjs), so every other
//              screen sees the same records.
// onOpenCase   (required) onOpenCase(commitmentId): "Open the full case" on a
//              slip. The commitment id is all a case screen needs.
// onGo         (optional) onGo(page): the front's own way round the rest of the
//              book, a folded note at the top of the desk called "The rest of
//              the book". `page` is one of "todo", "papers", "companies",
//              "daybook", "balance", "bench" ("tray" is also a page name the
//              parent may map; the book already has its own in-tray, so the
//              note has no line for it). The front does no routing itself.
//              Without onGo the note is not there. With `tabs` it is not there
//              either: the tabs are then the way round.
// tabs         (optional) a React node, put directly above the ledger sheet in
//              line with its text. It is wrapped in <div class="book-front__tabs">.
// tools        (optional) a React node, put at the right end of the top bar.
//              It is wrapped in <div class="book-front__tools">.
//
// The book is drawn in a tree of its own under the element this renders
// (class "book-front"), with the kit's stylesheet and the front's own rules
// inside it, so styles from the pages around it do not reach the book and the
// book's do not reach them. `tabs` and `tools` stay ordinary children of that
// element and keep the styles of whoever passed them; the book only gives
// them their place. The faces are the three packages imported below; their
// @font-face rules are the only thing this adds to the page itself.

import React, { useEffect, useMemo, useRef } from 'react';
import '@fontsource-variable/besley';
import '@fontsource-variable/besley/wght-italic.css';
import '@fontsource-variable/libre-franklin';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/400-italic.css';
import '@fontsource/courier-prime/700.css';
import kitCss from '../kit/paper.css?inline';
import bookCss from './book.css?inline';
import { createBook } from './book.js';
import { scopeKit } from './kit-scope.mjs';
import { bookFor, keeperFor } from './selectors.mjs';
import { acceptOfferCommands, approveLetterCommands, declineOfferCommands, nextInvoiceCommands, plainFailure, readDocument } from './commands.mjs';

// The kit eases a paper's lift as a number. Inside the book's own tree that has
// to be declared to the page; when the kit's stylesheet is on the page too, it
// already is, and this does nothing.
try {
  globalThis.CSS?.registerProperty?.({ name: '--lift', syntax: '<number>', inherits: false, initialValue: '0' });
} catch { /* already declared */ }

const SHEET = `:host{display:block}\n${scopeKit(kitCss)}\n${bookCss}`;

// A demo workspace has made-up vendors and a lever that brings the next invoice in.
const isDemo = (service) => service.authMode !== 'managed-password';
// The app never writes a moment earlier than the last one it recorded.
const momentFor = (workspace) => {
  const now = new Date().toISOString();
  const last = workspace.events.at(-1)?.observedAt;
  return last && last > now ? last : now;
};
// The visitor's own date, for a paper the demo dates today.
const dayNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const readingOf = (service, workspace = service.workspace) => bookFor(workspace, { now: momentFor(workspace), keeper: keeperFor(service), demo: isDemo(service), day: dayNow() });

export default function BookFront({ service, onOpenCase, onGo, tabs, tools }) {
  const host = useRef(null);
  const drawn = useRef(null);
  const live = useRef({ service, onOpenCase, onGo });
  live.current = { service, onOpenCase, onGo };

  const workspace = service.workspace;
  const reading = useMemo(
    () => (workspace ? readingOf(live.current.service, workspace) : null),
    [workspace, service.authMode, service.actor?.id, service.session?.user?.name, service.session?.workspace?.name],
  );
  // the front's own way round is there only when it has somewhere to send people and no tabs do that job
  const ownWayRound = Boolean(onGo) && !tabs;

  useEffect(() => {
    const tree = host.current.shadowRoot ?? host.current.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = SHEET;
    const root = document.createElement('div');
    root.className = 'book-front';
    tree.replaceChildren(style, root);

    // Send a batch to the app and read the book again from what it wrote.
    const record = async (build) => {
      const { service: app } = live.current;
      if (!app.workspace) throw new Error('The book is still opening. Try again in a moment.');
      const context = { actor: app.actor, now: momentFor(app.workspace), day: dayNow() };
      try {
        const built = await build(app.workspace, context);
        const commands = Array.isArray(built) ? built : built.commands ?? [];
        const reply = commands.length ? await app.commands(commands) : null;
        const after = reply?.workspace ?? live.current.service.workspace ?? app.workspace;
        return { built, book: readingOf(live.current.service, after) };
      } catch (error) {
        throw new Error(plainFailure(error), { cause: error });
      }
    };

    drawn.current = createBook(root, {
      approve: async (id) => (await record((ws, context) => approveLetterCommands(ws, id, context))).book,
      accept: async (id, offerId) => (await record((ws, context) => acceptOfferCommands(ws, id, offerId, context))).book,
      decline: async (id, offerId, reason) => (await record(() => declineOfferCommands(offerId, reason))).book,
      nextInvoice: async (id) => (await record((ws, context) => nextInvoiceCommands(ws, id, context))).book,
      read: async (text) => {
        const { built, book } = await record((ws, context) => readDocument(ws, text, context));
        return { outcome: built, book };
      },
      openCase: (commitmentId) => live.current.onOpenCase?.(commitmentId),
      go: (page) => live.current.onGo?.(page),
    });
    return () => { drawn.current?.destroy(); drawn.current = null; };
  }, []);

  useEffect(() => { drawn.current?.rest(ownWayRound); }, [ownWayRound]);
  useEffect(() => { drawn.current?.update(reading); }, [reading]);

  return (
    <div className="book-front" ref={host} data-runtime={service.mode}>
      {tabs ? <div className="book-front__tabs" slot="tabs">{tabs}</div> : null}
      {tools ? <div className="book-front__tools" slot="tools">{tools}</div> : null}
    </div>
  );
}
