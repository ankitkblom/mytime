import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const Field = ({ label, children }) => <label>{label}{children}</label>;

export default function Admin() {
  const [tab, setTab] = useState('users');
  const [meta, setMeta] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allCats, setAllCats] = useState([]);
  const [msg, setMsg] = useState(null);
  const reload = useCallback(async () => {
    setMeta(await api('/meta')); setUsers(await api('/admin/users'));
    setProjects(await api('/admin/projects')); setAllCats(await api('/admin/categories'));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const post = (path, body, reset) => async (e) => {
    e.preventDefault(); setMsg(null);
    try { await api(path, { method: 'POST', body }); reset(); await reload(); setMsg({ ok: 'Added' }); } catch (x) { setMsg({ err: x.message }); }
  };
  const toggleUser = async (u) => {
    try { await api(`/admin/users/${u.id}`, { method: 'PUT', body: { ...u, active: !u.active } }); reload(); } catch (x) { setMsg({ err: x.message }); }
  };

  const [u, setU] = useState({ empId: '', name: '', email: '', departmentId: '', designation: '', role: 'employee' });
  const emptyP = { id: null, code: '', name: '', categoryId: '', active: true };
  const [p, setP] = useState(emptyP);
  const [bulk, setBulk] = useState({ lines: '', categoryId: '' });
  const [newCat, setNewCat] = useState('');
  const topCats = allCats;
  const saveProject = async (e) => {
    e.preventDefault(); setMsg(null);
    const body = { code: p.code, name: p.name, categoryId: num(p.categoryId), active: p.active };
    try { await api(p.id ? `/admin/projects/${p.id}` : '/admin/projects', { method: p.id ? 'PUT' : 'POST', body }); setP(emptyP); await reload(); setMsg({ ok: 'Saved' }); }
    catch (x) { setMsg({ err: x.message }); }
  };
  const saveBulk = async (e) => {
    e.preventDefault(); setMsg(null);
    try {
      const r = await api('/admin/projects/bulk', { method: 'POST', body: { lines: bulk.lines, categoryId: num(bulk.categoryId) } });
      setBulk({ ...bulk, lines: '' }); await reload();
      setMsg({ ok: `Added ${r.added}.${r.skipped.length ? ` Skipped (duplicate/invalid): ${r.skipped.join('; ')}` : ''}` });
    } catch (x) { setMsg({ err: x.message }); }
  };
  const addCat = async (name) => {
    if (!name.trim()) return; setMsg(null);
    try { await api('/admin/categories', { method: 'POST', body: { name } }); await reload(); } catch (x) { setMsg({ err: x.message }); }
  };
  const editCat = async (cat, patch) => {
    try { await api(`/admin/categories/${cat.id}`, { method: 'PUT', body: { name: cat.name, active: cat.active, ...patch } }); await reload(); } catch (x) { setMsg({ err: x.message }); }
  };
  const rename = (cat) => { const n = window.prompt('New name', cat.name); if (n && n.trim()) editCat(cat, { name: n.trim() }); };
  const [d, setD] = useState({ name: '', code: '', parentId: '' });
  const num = (v) => (v ? Number(v) : null);

  if (!meta) return <p>Loading…</p>;
  return (
    <>
      <div className="row"><h2>Admin</h2>
        {['users', 'projects', 'categories', 'departments'].map((t) => <button key={t} className={tab === t ? 'primary' : ''} onClick={() => { setTab(t); setMsg(null); }}>{t}</button>)}</div>
      {msg && <p className={msg.err ? 'error' : 'ok'}>{msg.err || msg.ok}</p>}

      {tab === 'users' && (<>
        <form className="card row wrap" onSubmit={post('/admin/users', { ...u, departmentId: num(u.departmentId), designation: u.designation || null }, () => setU({ ...u, empId: '', name: '', email: '', designation: '' }))}>
          <Field label="Emp ID"><input value={u.empId} onChange={(e) => setU({ ...u, empId: e.target.value })} required /></Field>
          <Field label="Name"><input value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} required /></Field>
          <Field label="Email (@bloom-india.com)"><input type="email" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} required /></Field>
          <Field label="Department"><select value={u.departmentId} onChange={(e) => setU({ ...u, departmentId: e.target.value })}>
            <option value="">—</option>{meta.departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Designation"><input value={u.designation} onChange={(e) => setU({ ...u, designation: e.target.value })} /></Field>
          <Field label="Role"><select value={u.role} onChange={(e) => setU({ ...u, role: e.target.value })}><option>employee</option><option>admin</option></select></Field>
          <button className="primary">Add user</button>
        </form>
        <p className="hint">New users choose their own password with “First time / forgot password?” on the sign-in page (email code).</p>
        <table><thead><tr><th>Emp ID</th><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Password</th><th /></tr></thead>
          <tbody>{users.map((x) => <tr key={x.id} className={x.active ? '' : 'off'}><td>{x.empId}</td><td>{x.name}</td><td>{x.email}</td><td>{x.department}</td><td>{x.role}</td>
            <td>{x.hasPassword ? 'set' : 'pending'}</td><td><button onClick={() => toggleUser(x)}>{x.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></>)}

      {tab === 'projects' && (<>
        <p className="hint">Add categories first (Categories tab), then add project codes under them. Employees only see the project codes assigned to the category they choose. Projects marked “Unassigned” are not selectable by anyone; use the dropdown in the table to assign each one.</p>
        <form className="card row wrap" onSubmit={saveProject}>
          <Field label="Category"><select value={p.categoryId} onChange={(e) => setP({ ...p, categoryId: e.target.value })}>
            <option value="">— any —</option>{topCats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Project code"><input value={p.code} onChange={(e) => setP({ ...p, code: e.target.value })} required /></Field>
          <Field label="Project name"><input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required /></Field>
          <button className="primary">{p.id ? 'Save changes' : 'Add project'}</button>
          {p.id && <button type="button" onClick={() => setP(emptyP)}>Cancel</button>}
        </form>
        <details><summary>Bulk add many projects</summary>
          <form className="card" onSubmit={saveBulk}>
            <div className="row wrap">
              <Field label="Category"><select value={bulk.categoryId} onChange={(e) => setBulk({ ...bulk, categoryId: e.target.value })}>
                <option value="">— any —</option>{topCats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            </div>
            <Field label="One per line, like: 928 - Zuari P3"><textarea rows="6" value={bulk.lines} onChange={(e) => setBulk({ ...bulk, lines: e.target.value })} required /></Field>
            <button className="primary">Add all</button>
          </form></details>
        <table><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Status</th><th /></tr></thead>
          <tbody>{projects.map((x) => <tr key={x.id} className={x.active ? '' : 'off'}><td>{x.code}</td><td>{x.name}</td><td><select value={x.categoryId ?? ''} onChange={(e) => api(`/admin/projects/${x.id}`, { method: 'PUT', body: { code: x.code, name: x.name, categoryId: num(e.target.value), active: x.active } }).then(reload).catch((er) => setMsg({ err: er.message }))}>
              <option value="">Unassigned</option>{topCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
            <td>{x.active ? 'active' : 'inactive'}</td>
            <td><button onClick={() => { setP({ ...x, categoryId: x.categoryId ?? '' }); window.scrollTo(0, 0); }}>Edit</button>{' '}
              <button onClick={() => api(`/admin/projects/${x.id}`, { method: 'PUT', body: { code: x.code, name: x.name, categoryId: x.categoryId, active: !x.active } }).then(reload).catch((e) => setMsg({ err: e.message }))}>{x.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></>)}

      {tab === 'categories' && (<>
        <form className="card row wrap" onSubmit={(e) => { e.preventDefault(); addCat(newCat); setNewCat(''); }}>
          <Field label="New category"><input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Technical-CS" /></Field>
          <button className="primary">Add category</button>
        </form>
        <table><thead><tr><th>Category</th><th>Projects</th><th>Status</th><th /></tr></thead>
          <tbody>{topCats.map((cat) => (
            <tr key={cat.id} className={cat.active ? '' : 'off'}><td>{cat.name}</td>
              <td>{projects.filter((x) => x.categoryId === cat.id).length}</td><td>{cat.active ? 'active' : 'inactive'}</td>
              <td><button onClick={() => rename(cat)}>Rename</button>{' '}
                <button onClick={() => editCat(cat, { active: !cat.active })}>{cat.active ? 'Deactivate' : 'Activate'}</button></td></tr>))}</tbody></table></>)}

      {tab === 'departments' && (<>
        <form className="card row wrap" onSubmit={post('/admin/departments', { name: d.name, code: d.code || null, parentId: num(d.parentId) }, () => setD({ name: '', code: '', parentId: '' }))}>
          <Field label="Name"><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} required /></Field>
          <Field label="Code (e.g. HR-001)"><input value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} /></Field>
          <Field label="Parent"><select value={d.parentId} onChange={(e) => setD({ ...d, parentId: e.target.value })}>
            <option value="">— none —</option>{meta.departments.filter((x) => !x.parent_id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <button className="primary">Add</button></form>
        <ul>{meta.departments.filter((x) => !x.parent_id).map((x) => <li key={x.id}><b>{x.name}</b> {x.code}
          <ul>{meta.departments.filter((s) => s.parent_id === x.id).map((s) => <li key={s.id}>{s.name}</li>)}</ul></li>)}</ul></>)}
    </>
  );
}
