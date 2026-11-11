// The name plate: who is holding the pen. In the demo book you can pick up any
// of the five pens; on a team book you sign in, and the plate shows your name.

import React, { useState } from 'react';
import { Btn, Close, Field, Over, Paper, Why, cx } from './parts.jsx';
import { ROLES, plainError, roleName } from './roles.mjs';

const isDemo = service => service.authMode === 'local-demo' || service.authMode === 'browser-local';

export function plateLines(service) {
  if (service.authMode === 'managed-password') {
    const user = service.session?.user;
    if (!user) return ['Sign in', 'to your team’s book'];
    return [user.name || 'You', `${roleName(service.actor.role)} · ${service.session?.workspace?.name || 'no team yet'}`];
  }
  return ['Demo book', roleName(service.actor.role).toLowerCase()];
}

export default function Plate({ service, say, onReset }) {
  const [open, setOpen] = useState(false);
  const [name, role] = plateLines(service);
  return (
    <>
      <button type="button" className="bk-plate" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <b>{name}</b><span>{role}</span>
      </button>
      {open && (
        <Over onClose={() => setOpen(false)} label="Who is holding the pen">
          <Paper w={132} rot={-0.6} className="bk-form">
            <Close onClose={() => setOpen(false)} />
            {isDemo(service)
              ? <DemoPens service={service} say={say} onReset={onReset} onClose={() => setOpen(false)} />
              : <TeamBook service={service} say={say} onClose={() => setOpen(false)} />}
          </Paper>
        </Over>
      )}
    </>
  );
}

function DemoPens({ service, say, onReset, onClose }) {
  const [confirm, setConfirm] = useState(false);
  async function pick(role) {
    if (role === service.actor.role) { onClose(); return; }
    try {
      await service.changeRole(role);
      say(`You are holding the ${roleName(role).toLowerCase()}’s pen.`);
      onClose();
    } catch (error) { say(plainError(error), { wrong: true }); }
  }
  async function reset() {
    try {
      await service.resetDemo();
      setConfirm(false);
      onReset?.();
      say('The demo book is back to its first page.');
      onClose();
    } catch (error) { say(plainError(error), { wrong: true }); }
  }
  return (
    <>
      <h2 className="bk-form-title">Who is holding the pen?<small>DEMO BOOK</small></h2>
      <p className="bk-typed" style={{ marginBottom: 14 }}>
        A decision takes three people: one prepares it, one approves it, one writes it in. Pick up a pen to be that person.
      </p>
      <ul className="bk-route" style={{ gridTemplateColumns: '1fr' }}>
        {ROLES.map(role => (
          <li key={role.id} className={cx(role.id === service.actor.role && 'is-now')} style={{ minHeight: 0 }}>
            <button type="button" className="bk-link" style={{ display: 'grid', width: '100%', textDecoration: 'none' }} data-autofocus={role.id === service.actor.role ? '' : undefined} disabled={service.busy} onClick={() => pick(role.id)}>
              <b style={{ font: '700 17px/1.2 var(--bk-display)' }}>{role.name}{role.id === service.actor.role ? ' (you, now)' : ''}</b>
              <span className="bk-typed" style={{ fontSize: 14.5 }}>{role.does}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="bk-actions" style={{ marginTop: 18 }}>
        {!confirm
          ? <button type="button" className="bk-link" onClick={() => setConfirm(true)}>Start the demo book again</button>
          : <>
              <Btn onClick={reset} busy={service.busy ? 'Starting again…' : ''} why={service.actor.role === 'admin' ? '' : 'Only the owner can start the book again. Pick up the owner’s pen first.'}>Yes, wipe it and start again</Btn>
              <button type="button" className="bk-link" onClick={() => setConfirm(false)}>Keep it</button>
            </>}
      </div>
      {service.mode === 'browser' && <Why>This book is kept in this browser only.</Why>}
    </>
  );
}

function TeamBook({ service, say, onClose }) {
  const user = service.session?.user;
  const [tab, setTab] = useState(user ? 'team' : 'signin');
  const [form, setForm] = useState({});
  const [invite, setInvite] = useState(null);
  const set = key => event => setForm(f => ({ ...f, [key]: event.target.value }));
  async function run(task, done) {
    try { const result = await task(); done?.(result); }
    catch (error) { say(plainError(error), { wrong: true }); }
  }
  if (!user) {
    return (
      <>
        <h2 className="bk-form-title">{tab === 'signin' ? 'Sign in' : 'Join with an invitation'}<small>TEAM BOOK</small></h2>
        <form className="bk-fields" style={{ gridTemplateColumns: '1fr' }} onSubmit={e => { e.preventDefault(); run(() => tab === 'signin' ? service.login({ email: form.email, password: form.password }) : service.acceptInvitation({ token: form.token, name: form.name, password: form.password }), onClose); }}>
          {tab === 'signin'
            ? <Field label="Email"><input type="email" required autoComplete="username" data-autofocus="" value={form.email || ''} onChange={set('email')} /></Field>
            : <>
                <Field label="Invitation code" hint="An admin sends you this."><input required data-autofocus="" value={form.token || ''} onChange={set('token')} /></Field>
                <Field label="Your name"><input required autoComplete="name" value={form.name || ''} onChange={set('name')} /></Field>
              </>}
          <Field label={tab === 'signin' ? 'Password' : 'Choose a password'}><input type="password" required autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} value={form.password || ''} onChange={set('password')} /></Field>
          <div className="bk-actions">
            <Btn as="button" type="submit" busy={service.busy ? 'Opening…' : ''}>{tab === 'signin' ? 'Open the book' : 'Join the team'}</Btn>
            <button type="button" className="bk-link" onClick={() => setTab(tab === 'signin' ? 'join' : 'signin')}>{tab === 'signin' ? 'I have an invitation' : 'I already have an account'}</button>
          </div>
        </form>
        {service.error && <p className="bk-why" role="alert" style={{ marginTop: 12 }}>{plainError(service.error)}</p>}
      </>
    );
  }
  const teams = service.session?.workspaces || [];
  const here = service.session?.workspace;
  return (
    <>
      <h2 className="bk-form-title">{user.name}<small>{here ? `${roleName(service.actor.role).toUpperCase()} · ${here.name.toUpperCase()}` : 'NO TEAM YET'}</small></h2>
      {!here && <p className="bk-typed" style={{ marginBottom: 14 }}>You’re not on a team yet. Ask an admin to invite you, or start a team book of your own.</p>}
      {teams.length > 1 && (
        <Field label="Open another team’s book">
          <select value={here?.id || ''} onChange={e => run(() => service.switchWorkspace(e.target.value), () => { say('Opened.'); onClose(); })}>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({roleName(t.role).toLowerCase()})</option>)}
          </select>
        </Field>
      )}
      <div className="bk-actions" style={{ margin: '16px 0' }}>
        {['invite', 'newteam', 'password'].map(id => (
          <button key={id} type="button" className="bk-link" aria-pressed={tab === id} onClick={() => { setTab(tab === id ? 'team' : id); setInvite(null); }}>
            {{ invite: 'Invite someone', newteam: 'Start a new team book', password: 'Change my password' }[id]}
          </button>
        ))}
        <button type="button" className="bk-link" onClick={() => run(() => service.logout(), onClose)}>Sign out</button>
      </div>
      {tab === 'invite' && (
        <form className="bk-fields" onSubmit={e => { e.preventDefault(); run(() => service.createInvitation({ email: form.inviteEmail, name: form.inviteName || undefined, role: form.inviteRole || 'analyst' }), setInvite); }}>
          <Field label="Their email"><input type="email" required value={form.inviteEmail || ''} onChange={set('inviteEmail')} /></Field>
          <Field label="Their name"><input value={form.inviteName || ''} onChange={set('inviteName')} /></Field>
          <Field label="They will be"><select value={form.inviteRole || 'analyst'} onChange={set('inviteRole')}>{ROLES.map(r => <option key={r.id} value={r.id}>{r.name}: {r.does}</option>)}</select></Field>
          <div className="bk-actions"><Btn as="button" type="submit" busy={service.busy ? 'Writing the invitation…' : ''}>Write the invitation</Btn></div>
          {invite && <p className="bk-typed" style={{ gridColumn: '1 / -1' }}>Give them this code yourself. Nothing was emailed.<br /><b style={{ overflowWrap: 'anywhere' }}>{invite.token || invite.invitation?.token}</b></p>}
        </form>
      )}
      {tab === 'newteam' && (
        <form className="bk-fields" onSubmit={e => { e.preventDefault(); run(() => service.createWorkspace({ name: form.teamName }), () => { say('A new book, opened at its first page.'); onClose(); }); }}>
          <Field label="Team name"><input required value={form.teamName || ''} onChange={set('teamName')} /></Field>
          <div className="bk-actions"><Btn as="button" type="submit" busy={service.busy ? 'Opening a new book…' : ''}>Open a new book</Btn></div>
        </form>
      )}
      {tab === 'password' && (
        <form className="bk-fields" onSubmit={e => { e.preventDefault(); run(() => service.changePassword({ currentPassword: form.current, newPassword: form.next }), () => { say('Password changed. Sign in again with the new one.'); onClose(); }); }}>
          <Field label="Password now"><input type="password" required autoComplete="current-password" value={form.current || ''} onChange={set('current')} /></Field>
          <Field label="New password"><input type="password" required autoComplete="new-password" value={form.next || ''} onChange={set('next')} /></Field>
          <div className="bk-actions"><Btn as="button" type="submit" busy={service.busy ? 'Changing it…' : ''}>Change it</Btn></div>
        </form>
      )}
    </>
  );
}
