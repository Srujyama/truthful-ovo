import React,{useEffect,useId,useRef,useState} from 'react';
import {Building2,ChevronDown,KeyRound,LogOut,UserRound,X} from 'lucide-react';
import './workspace-account.css';

const roles=['viewer','analyst','approver','executor','admin'];
const formInput=form=>Object.fromEntries(new FormData(form));

export default function WorkspaceAccount({service}) {
  const id=useId(),dialog=useRef(null),trigger=useRef(null),mounted=useRef(true),working=useRef(false),generation=useRef(0);
  const [open,setOpen]=useState(false),[access,setAccess]=useState('login'),[pending,setPending]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[invitation,setInvitation]=useState(null);
  const managed=service.authMode==='managed-password',signedIn=managed&&Boolean(service.session?.user),session=service.session;
  const disabled=Boolean(pending||service.busy),checking=service.authStatus==='checking'||service.authMode==='detecting';
  const connectionError=service.authMode==='service-error';
  const runtime=managed?'Managed · SQLite':service.mode==='server'?'Local demo · SQLite':service.mode==='browser'?'Browser-local demo':'Checking service';
  const title=connectionError?'Workspace connection':signedIn?'Workspace account':managed?'Access your workspace':'Demo workspace';
  const label=checking?'Connecting…':connectionError?'Service unavailable':managed?(signedIn?(session.workspace?.name||'Workspace account'):'Sign in'):'Demo account';

  useEffect(()=>{
    mounted.current=true;
    return()=>{mounted.current=false;generation.current++;};
  },[]);
  useEffect(()=>{
    setInvitation(null);setError('');setMessage('');
  },[session?.user?.id,session?.workspace?.id,service.actor.role,service.authMode]);
  useEffect(()=>{
    const node=dialog.current;
    if(open&&!node.open) node.showModal();
    else if(!open&&node.open) node.close();
  },[open]);

  function closed() {
    generation.current++;setOpen(false);setError('');setMessage('');setInvitation(null);
    dialog.current?.querySelectorAll('form').forEach(form=>form.reset());
    trigger.current?.focus();
  }
  function close() { if(dialog.current?.open)dialog.current.close();else closed(); }
  async function run(name,task,onSuccess) {
    if(working.current||service.busy) return;
    const epoch=generation.current;
    working.current=true;setPending(name);setError('');setMessage('');
    try {
      const result=await task();
      if(mounted.current&&epoch===generation.current) onSuccess?.(result);
    } catch(e) {
      if(mounted.current&&epoch===generation.current) setError(e.message||'The request failed. Try again.');
    } finally {
      working.current=false;
      if(mounted.current) setPending('');
    }
  }
  function submit(event,name,task,onSuccess) {
    event.preventDefault();const form=event.currentTarget,input=formInput(form);
    run(name,()=>task(input),result=>{form.reset();onSuccess?.(result);});
  }

  return <>
    <button ref={trigger} type="button" aria-label={signedIn?`Workspace account: ${label}`:label} className="workspace-account-trigger" aria-haspopup="dialog" aria-controls={`${id}-dialog`} aria-expanded={open} onClick={()=>setOpen(true)}>
      <UserRound size={17} aria-hidden="true"/><span>{label}</span><ChevronDown size={13} aria-hidden="true"/>
    </button>
    <dialog ref={dialog} id={`${id}-dialog`} className="workspace-account-dialog" aria-labelledby={`${id}-title`} onClose={closed} onCancel={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();}}}>
      <header className="wa-heading"><div><h2 id={`${id}-title`}>{title}</h2><p>{runtime}</p></div><button type="button" className="wa-close" aria-label="Close account" onClick={close}><X size={20} aria-hidden="true"/></button></header>
      <div className="wa-body" aria-busy={Boolean(pending)}>
        {checking?<div className="wa-connection"><p>Checking the workspace service and your session…</p><p>Your workspace will appear when the connection is ready.</p></div>:connectionError?<div className="wa-connection"><p>The service responded with an error. Retry the connection to open your recorded workspace.</p></div>:managed&&!signedIn?<>
          <p className="wa-intro">Sign in with your workspace account, or join using an invitation supplied by a workspace administrator.</p>
          <div className="wa-access-options" aria-label="Account access"><button type="button" aria-pressed={access==='login'} disabled={disabled} onClick={()=>{setAccess('login');setError('');}}>Sign in</button><button type="button" aria-pressed={access==='invitation'} disabled={disabled} onClick={()=>{setAccess('invitation');setError('');}}>Join with invitation</button></div>
          {access==='login'?<form className="wa-form" onSubmit={event=>submit(event,'Signing in…',input=>service.login(input),()=>{setMessage('Signed in. Your workspace is ready.');})}>
            <label htmlFor={`${id}-email`}>Email<input id={`${id}-email`} name="email" type="email" autoComplete="username" maxLength={254} required disabled={disabled}/></label>
            <label htmlFor={`${id}-password`}>Password<input id={`${id}-password`} name="password" type="password" autoComplete="current-password" maxLength={256} required disabled={disabled}/></label>
            <button className="wa-primary" type="submit" disabled={disabled}>{pending||'Sign in'}</button>
          </form>:<form className="wa-form" onSubmit={event=>submit(event,'Joining workspace…',input=>service.acceptInvitation({...input,...(!input.name.trim()?{name:undefined}:{})}),()=>{setAccess('login');setMessage('Invitation accepted. You are signed in to the invited workspace.');})}>
            <label htmlFor={`${id}-token`}>Invitation token<input id={`${id}-token`} name="token" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={512} required disabled={disabled}/></label>
            <label htmlFor={`${id}-name`}>Your name <span className="wa-optional">(optional)</span><input id={`${id}-name`} name="name" autoComplete="name" maxLength={160} disabled={disabled}/></label>
            <label htmlFor={`${id}-join-password`}>Account password<input id={`${id}-join-password`} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required disabled={disabled}/></label>
            <p className="wa-help">New account: choose a password of 12–256 characters. Existing account: enter your current password. The invitation determines your email, workspace and role.</p>
            <button className="wa-primary" type="submit" disabled={disabled}>{pending||'Accept invitation and sign in'}</button>
          </form>}
        </>:signedIn?<>
          <section className="wa-identity" aria-label="Current account"><UserRound size={22} aria-hidden="true"/><div><strong>{session.user.name}</strong><span>{session.user.email}</span></div><span className="wa-role">{service.actor.role}</span></section>
          <form className="wa-form wa-workspace" onSubmit={event=>submit(event,'Switching workspace…',input=>service.switchWorkspace(input.workspaceId),()=>{setMessage('Workspace selected.');})}>
            <label htmlFor={`${id}-workspace`}>Workspace<select id={`${id}-workspace`} name="workspaceId" defaultValue={session.workspace?.id||''} key={session.workspace?.id||'unselected'} required disabled={disabled||!session.workspaces?.length}>
              {!session.workspace&&<option value="" disabled>Select a workspace</option>}
              {session.workspaces?.map(workspace=><option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.role}</option>)}
            </select></label>
            <button type="submit" className="wa-secondary" disabled={disabled||!session.workspaces?.length}><Building2 size={16} aria-hidden="true"/>Switch workspace</button>
          </form>
          {!session.workspaces?.length&&<p className="wa-help">No active workspace membership is available. Ask an administrator for an invitation{session.user.systemAdmin?', or create a workspace below':''}.</p>}
          <p className="wa-help">Your membership determines your role. Workspace records and financial authority remain separate for each workspace.</p>
          {service.actor.role==='admin'&&session.workspace&&<details className="wa-section"><summary>Invite a workspace member</summary><form className="wa-form" onSubmit={event=>submit(event,'Creating invitation…',input=>service.createInvitation({...input,...(!input.name.trim()?{name:undefined}:{})}),result=>{setInvitation({...result,workspaceName:session.workspace.name});setMessage('Invitation created. Copy the token and share it privately.');})}>
            <label htmlFor={`${id}-invite-email`}>Member email<input id={`${id}-invite-email`} name="email" type="email" autoComplete="off" maxLength={254} required disabled={disabled}/></label>
            <label htmlFor={`${id}-invite-name`}>Member name <span className="wa-optional">(optional)</span><input id={`${id}-invite-name`} name="name" maxLength={160} disabled={disabled}/></label>
            <label htmlFor={`${id}-invite-role`}>Workspace role<select id={`${id}-invite-role`} name="role" defaultValue="analyst" disabled={disabled}>{roles.map(role=><option key={role}>{role}</option>)}</select></label>
            <p className="wa-help">The token expires in seven days. A new invitation for the same email replaces the previous unused invitation. No email is sent.</p>
            <button className="wa-primary" type="submit" disabled={disabled}>Create invitation</button>
          </form></details>}
          {invitation&&<section className="wa-invitation" aria-label="Created invitation"><h3>Invitation for {invitation.invitation.email}</h3><p>{invitation.workspaceName} · {invitation.invitation.role}. Share the token privately. It is shown only while this account dialog stays open.</p><label htmlFor={`${id}-created-token`}>Invitation token</label><textarea id={`${id}-created-token`} value={invitation.token} readOnly rows={2} onFocus={event=>event.currentTarget.select()}/><button type="button" className="wa-secondary" onClick={()=>run('Copying invitation…',async()=>{if(!navigator.clipboard?.writeText)throw new Error('Automatic copying is unavailable. Select and copy the token above.');await navigator.clipboard.writeText(invitation.token);},()=>setMessage('Invitation token copied.'))} disabled={disabled}>Copy invitation token</button></section>}
          {session.user.systemAdmin&&<details className="wa-section"><summary>Create a workspace</summary><form className="wa-form" onSubmit={event=>submit(event,'Creating workspace…',input=>service.createWorkspace(input),()=>{setMessage('Workspace created and selected.');})}><label htmlFor={`${id}-workspace-name`}>Workspace name<input id={`${id}-workspace-name`} name="name" maxLength={160} required disabled={disabled}/></label><p className="wa-help">Creates an empty workspace with you as its first administrator.</p><button className="wa-primary" type="submit" disabled={disabled}>Create and open workspace</button></form></details>}
          <details className="wa-section"><summary>Change password</summary><form className="wa-form" onSubmit={event=>submit(event,'Changing password…',input=>service.changePassword(input),()=>{setAccess('login');setMessage('Password changed. All sessions were ended. Sign in with your new password.');})}>
            <input className="wa-username" aria-label="Account email" type="text" autoComplete="username" value={session.user.email} readOnly tabIndex={-1}/>
            <label htmlFor={`${id}-current-password`}>Current password<input id={`${id}-current-password`} name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} disabled={disabled}/></label>
            <label htmlFor={`${id}-new-password`}>New password<input id={`${id}-new-password`} name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required disabled={disabled}/></label>
            <p className="wa-help">Use 12–256 characters. Changing your password signs out all sessions.</p><button className="wa-primary" type="submit" disabled={disabled}><KeyRound size={16} aria-hidden="true"/>Change password</button>
          </form></details>
          <div className="wa-signout"><span>Signed in with a managed account</span><button className="wa-secondary" type="button" disabled={disabled} onClick={()=>run('Signing out…',()=>service.logout(),()=>{setAccess('login');setMessage('Signed out.');})}><LogOut size={16} aria-hidden="true"/>Sign out</button></div>
        </>:<section className="wa-demo"><p>This is a fictional finance workspace. Demo identities let you try the analyst, approver and executor handoff. They are not account authentication.</p><label htmlFor={`${id}-demo-role`}>Fictional role<select id={`${id}-demo-role`} value={service.actor.role} disabled={disabled} onChange={event=>run('Changing demo role…',()=>service.changeRole(event.target.value))}>{roles.map(role=><option key={role}>{role}</option>)}</select></label><p className="wa-help">{service.mode==='browser'?'Records stay in this browser.':'Records are stored in the local demo service.'} No external transaction is executed.</p></section>}
        {(error||service.error)&&<p className="wa-error" role="alert">{error||service.error}</p>}
        {message&&<p className="wa-message" role="status">{message}</p>}
        {pending&&<p className="wa-pending" role="status">{pending}</p>}
        <div className="wa-footer"><span>{managed&&service.workspace?`Workspace revision ${service.serverRevision}`:managed?'Managed accounts require a workspace invitation':connectionError?'Recorded workspace unavailable':'Demo data is synthetic'}</span><button type="button" className="wa-text" disabled={disabled||checking} onClick={()=>run('Checking connection…',()=>service.refreshSession())}>Retry connection</button></div>
      </div>
    </dialog>
  </>;
}
