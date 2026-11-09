// Presentation selectors only. All money and eligibility remain supplied by the evaluated workspace.
export const followupFilters = [
  {id:'all',label:'All'},
  {id:'owed',label:'Still owed'},
  {id:'issued',label:'Issued'},
  {id:'conditional',label:'Conditional'},
  {id:'completed',label:'Completed'},
];
export const followupSorts = [
  {id:'due-asc',label:'Due date · earliest'},
  {id:'due-desc',label:'Due date · latest'},
  {id:'owed-desc',label:'Still owed · highest'},
  {id:'owed-asc',label:'Still owed · lowest'},
  {id:'applied-desc',label:'Applied · highest'},
];
const conditional = row => row.conditions.length > 0;
const owed = row => conditional(row) ? 0 : row.outstandingCents;
const matches = (row, filter) => filter === 'owed' ? row.outstandingCents > 0 && !conditional(row)
  : filter === 'issued' ? row.issuedCents > 0
  : filter === 'conditional' ? conditional(row)
  : filter === 'completed' ? row.outstandingCents === 0 && !conditional(row)
  : true;
export function selectFollowups(view,{query='',filter='all',sort='due-asc'}={}) {
  const names=new Map(view.vendors.map(v=>[v.id,v.name]));
  const name=row=>names.get(row.vendorId)||'Unknown company';
  const needle=query.trim().toLocaleLowerCase('en-US');
  const searched=view.commitments.filter(row=>`${name(row)} ${row.reference}`.toLocaleLowerCase('en-US').includes(needle));
  const counts=Object.fromEntries(followupFilters.map(({id})=>[id,searched.filter(row=>matches(row,id)).length]));
  const rows=searched.filter(row=>matches(row,filter)).slice();
  rows.sort((a,b)=>{
    let difference=sort==='due-desc'?(b.dueDate||'').localeCompare(a.dueDate||'')
      :sort==='owed-desc'?owed(b)-owed(a)
      :sort==='owed-asc'?owed(a)-owed(b)
      :sort==='applied-desc'?b.verifiedCents-a.verifiedCents
      :(a.dueDate||'9999').localeCompare(b.dueDate||'9999');
    return difference||name(a).localeCompare(name(b))||a.id.localeCompare(b.id);
  });
  return {rows,counts};
}
