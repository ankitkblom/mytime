import { useEffect, useState, createContext, useContext } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import ThemeToggle from './ThemeToggle.jsx';
import Login from './pages/Login.jsx';
import Timesheet from './pages/Timesheet.jsx';
import Reviews from './pages/Reviews.jsx';
import Summary from './pages/Summary.jsx';
import Admin from './pages/Admin.jsx';

const Ctx = createContext(null);
export const useMe = () => useContext(Ctx);

export default function App() {
  const [me, setMe] = useState(undefined);
  useEffect(() => { api('/auth/me').then(setMe).catch(() => setMe(null)); }, []);
  if (me === undefined) return <p className="center">Loading…</p>;
  if (!me) return <><div className="row" style={{ justifyContent: 'flex-end', padding: '8px 16px' }}><ThemeToggle /></div><Login onDone={() => api('/auth/me').then(setMe)} /></>;

  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }); setMe(null); };
  return (
    <Ctx.Provider value={me}>
      <header className="nav">
        <strong>Bloom Timesheet</strong>
        <nav>
          <NavLink to="/timesheet">My Timesheet</NavLink>
          <NavLink to="/reviews">Reviews</NavLink>
          <NavLink to="/summary">Summary</NavLink>
          {me.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <span className="who"><ThemeToggle />{me.name} <button onClick={logout}>Sign out</button></span>
      </header>
      <main>
        <Routes>
          <Route path="/timesheet" element={<Timesheet />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/summary" element={<Summary />} />
          {me.role === 'admin' && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Navigate to="/timesheet" replace />} />
        </Routes>
      </main>
    </Ctx.Provider>
  );
}
