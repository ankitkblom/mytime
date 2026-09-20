import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

export default function Reviews() {
  const [status, setStatus] = useState('submitted');
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(null);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => api(`/reviews?status=${status}`).then(setList), [status]);
  useEffect(() => { load().catch((e) => setErr(e.message)); setOpen(null); }, [load]);

  const view = async (id) => { setComment(''); setErr(''); setOpen(await api(`/reviews/${id}`)); };
  const decide = async (decision) => {
    setErr('');
    try { await api(`/reviews/${open.id}/decision`, { method: 'POST', body: { decision, comment } }); setOpen(null); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <>
      <div className="row"><h2>Reviews</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="submitted">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select></div>
      <table>
        <thead><tr><th>Date</th><th>Employee</th><th>Hours</th><th /></tr></thead>
        <tbody>{list.map((r) => (
          <tr key={r.id}><td>{r.date}</td><td>{r.employeeName} ({r.empId})</td><td>{r.hours}</td>
            <td><button onClick={() => view(r.id)}>Open</button></td></tr>))}
          {!list.length && <tr><td colSpan="4">Nothing here.</td></tr>}</tbody>
      </table>
      {open && (
        <div className="card">
          <h3>{open.employeeName} · {open.date}</h3>
          <table><thead><tr><th>Slot</th><th>Project</th><th>Category</th><th>Comments</th></tr></thead>
            <tbody>{open.entries.map((e) => (
              <tr key={e.slot}><td>{e.slot}</td><td>{e.projectCode} - {e.projectName}</td>
                <td>{e.category}</td><td>{e.description}</td></tr>))}</tbody></table>
          <p>Total: {open.entries.length * 0.5} h</p>
          {open.status === 'submitted' ? (
            <div className="row wrap">
              <input placeholder="Comment (required to reject)" value={comment} onChange={(e) => setComment(e.target.value)} className="grow" />
              <button className="primary" onClick={() => decide('approved')}>Approve</button>
              <button className="danger" onClick={() => decide('rejected')}>Reject</button>
            </div>) : <p>Status: {open.status}{open.reviewComment ? ` — ${open.reviewComment}` : ''}</p>}
          {err && <p className="error">{err}</p>}
        </div>)}
    </>
  );
}
