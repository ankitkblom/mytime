import { useState } from 'react';
import { getTheme, setTheme } from './theme.js';

export default function ThemeToggle() {
  const [t, setT] = useState(getTheme());
  const change = (e) => { setT(e.target.value); setTheme(e.target.value); };
  return (
    <select className="theme" value={t} onChange={change} aria-label="Theme">
      <option value="system">🖥 System</option><option value="light">☀️ Light</option><option value="dark">🌙 Dark</option>
    </select>
  );
}
