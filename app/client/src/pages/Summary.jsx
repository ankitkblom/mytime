import { useEffect, useState } from 'react';
import { api, today } from '../api';
import { useMe } from '../App.jsx';

export default function Summary() {
  const me = useMe();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [data, setData] = useState(null);
  const [team, setTeam] = useState(null);
  const [err, setErr] = useState('');
  const uq = userId ? `&userId=${userId}` : '';

  useEffect(() => { if (me.role === 'admin') api('/admin/users').then(setUsers); }, [me]);
  useEffect(() => {
    setErr('');
    api(`/summary/month?month=${month}&approvedOnly=${approvedOnly}${uq}`).then(setData).catch((e) => setErr(e.message));
    if (me.role === 'admin') api(`/summary/team?month=${month}`).then(setTeam).catch(() => {});
  }, [month, approvedOnly, userId]);

  return (
    <>
      <div className="row wrap"><h2>Summary</h2>
        <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        {me.role === 'admin' && (
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Me</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>)}
        <label className="inline"><input type="checkbox" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} /> Approved only</label>
        <span className="grow" />
        <a className="btn" href={`/api/summary/month.csv?month=${month}${uq}`}>Download CSV</a>
      </div>
      {err && <p className="error">{err}</p>}
      {data && (<>
        <p><b>Total: {data.totalHours} h</b> {approvedOnly ? '(approved)' : '(approved + pending)'}</p>
        <div className="grid2">
          <div><h3>Day-wise</h3>
            <table><thead><tr><th>Date</th><th>Day</th><th>Hours</th><th>Status</th><th>Approved by</th></tr></thead>
              <tbody>{data.days.map((d) => (
                <tr key={d.date}><td>{d.date}</td><td>{d.day}</td><td>{d.hours}</td>
                  <td><span className={`badge ${d.status}`}>{d.status}</span></td><td>{d.status === 'approved' ? d.approvedBy : ''}</td></tr>))}
                {!data.days.length && <tr><td colSpan="5">No entries.</td></tr>}</tbody></table></div>
          <div><h3>By project</h3>
            <table><thead><tr><th>Project</th><th>Hours</th></tr></thead>
              <tbody>{data.projects.map((p) => <tr key={p.code}><td>{p.code} - {p.name}</td><td>{p.hours}</td></tr>)}</tbody></table></div>
        </div></>)}
      {team && (<><h3>All employees ({month})</h3>
        <table><thead><tr><th>Emp ID</th><th>Name</th><th>Department</th><th>Approved h</th><th>Pending h</th></tr></thead>
          <tbody>{team.employees.map((u) => <tr key={u.id}><td>{u.empId}</td><td>{u.name}</td><td>{u.department}</td><td>{u.approvedHours}</td><td>{u.pendingHours}</td></tr>)}</tbody></table></>)}
    </>
  );
}
