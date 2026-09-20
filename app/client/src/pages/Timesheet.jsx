import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, today } from '../api';

const STATUS = { draft: 'Draft', submitted: 'Awaiting review', approved: 'Approved', rejected: 'Rejected' };

export default function Timesheet() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || today();
  const [meta, setMeta] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState({}); // slot -> {projectId, categoryId, description}
  const [reviewerId, setReviewerId] = useState('');
  const [msg, setMsg] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { api('/meta').then(setMeta); }, []);
  const load = useCallback(async () => {
    const s = await api(`/timesheets/${date}`);
    setSheet(s); setDirty(false);
    setRows(Object.fromEntries(s.entries.map((e) => [e.slot, e])));
    if (s.reviewerId) setReviewerId(String(s.reviewerId));
  }, [date]);
  useEffect(() => { load().catch((e) => setMsg({ err: e.message })); }, [load]);

  const editable = sheet && ['draft', 'rejected'].includes(sheet.status);
  const cats = meta?.categories ?? [];
  // Only projects assigned to the chosen category are listed
  const projectsFor = (r) => (meta?.projects ?? []).filter((p) =>
    r.categoryId && p.category_id === Number(r.categoryId));
  const projLabel = (id) => { const p = meta?.projects.find((x) => x.id === Number(id)); return p ? `${p.code} - ${p.name}` : ''; };
  const catName = (id) => meta?.categories.find((c) => c.id === Number(id))?.name ?? '';

  const upd = (i, patch) => {
    setRows((r) => ({ ...r, [i]: { slot: i, projectId: '', categoryId: '', description: '', ...r[i], ...patch } }));
    setDirty(true); setMsg(null);
  };
  const sameAsAbove = (i) => { const p = rows[i - 1]; if (p) upd(i, { ...p, slot: i }); };
  const clear = (i) => { const n = { ...rows }; delete n[i]; setRows(n); setDirty(true); };
  const filled = Object.values(rows).filter((r) => r.projectId);
  const hours = filled.length * 0.5;

  const payload = () => ({ entries: filled.map((e) => ({
    slot: e.slot, projectId: Number(e.projectId), categoryId: e.categoryId ? Number(e.categoryId) : null, description: e.description || null })) });
  const save = async () => {
    try { await api(`/timesheets/${date}`, { method: 'PUT', body: payload() }); await load(); setMsg({ ok: 'Saved' }); }
    catch (e) { setMsg({ err: e.message }); return false; }
    return true;
  };
  const submit = async () => {
    if (!reviewerId) return setMsg({ err: 'Choose a reviewer' });
    if (!(await save())) return;
    try { await api(`/timesheets/${date}/submit`, { method: 'POST', body: { reviewerId: Number(reviewerId) } }); await load(); setMsg({ ok: 'Submitted. Your reviewer has been emailed.' }); }
    catch (e) { setMsg({ err: e.message }); }
  };

  if (!meta || !sheet) return <p>Loading…</p>;
  return (
    <>
      <div className="row">
        <h2>My Timesheet</h2>
        <input type="date" value={date} max={today()} onChange={(e) => setParams({ date: e.target.value })} />
        <span className={`badge ${sheet.status}`}>{STATUS[sheet.status]}</span>
        <span className="grow" /><b>{hours} h</b>
      </div>
      {sheet.status === 'approved' && <p className="ok">Approved by {sheet.reviewerName} on {new Date(sheet.reviewedAt).toLocaleString()}.</p>}
      {sheet.status === 'submitted' && <p>Waiting for {sheet.reviewerName} to review.</p>}
      {sheet.status === 'rejected' && <p className="error">Rejected by {sheet.reviewerName}: {sheet.reviewComment}. Edit and resubmit.</p>}

      <table className="slots">
        <thead><tr><th>Time</th><th>Category</th><th>Project code</th><th>Comments</th>{editable && <th />}</tr></thead>
        <tbody>
          {meta.slots.map((sl) => { const r = rows[sl.index] || {}; const i = sl.index; return (
            <tr key={i} className={r.projectId ? 'filled' : ''}>
              <td>{sl.label}</td>
              {editable ? (<>
                <td><select value={r.categoryId || ''} onChange={(e) => upd(i, { categoryId: e.target.value, projectId: '' })}>
                  <option value="">Select…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                <td><select value={r.projectId || ''} disabled={!r.categoryId} onChange={(e) => upd(i, { projectId: e.target.value })}>
                  <option value="">{r.categoryId ? (projectsFor(r).length ? 'Select…' : 'No projects in this category') : 'Select category first'}</option>{projectsFor(r).map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}</select></td>
                <td><input value={r.description || ''} maxLength={500} placeholder="Write what you did in this slot…" onChange={(e) => upd(i, { description: e.target.value })} /></td>
                <td>{i > 0 && rows[i - 1] && <button className="link" onClick={() => sameAsAbove(i)}>same as above</button>}
                  {rows[i] && <button className="link" onClick={() => clear(i)}>clear</button>}</td>
              </>) : (<>
                <td>{catName(r.categoryId)}</td><td>{r.projectId ? projLabel(r.projectId) : '—'}</td><td>{r.description}</td>
              </>)}
            </tr>); })}
        </tbody>
      </table>

      {editable && (
        <div className="row wrap">
          <button onClick={save} disabled={!dirty}>Save draft</button>
          <span className="grow" />
          <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
            <option value="">Select reviewer…</option>
            {meta.reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}{r.designation ? ` (${r.designation})` : ''}</option>)}
          </select>
          <button className="primary" onClick={submit} disabled={!hours}>Submit for review</button>
        </div>
      )}
      {msg && <p className={msg.err ? 'error' : 'ok'}>{msg.err || msg.ok}</p>}
    </>
  );
}
