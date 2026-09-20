import { useState } from 'react';
import { api } from '../api';

// modes: login -> otp (2nd factor) | setpw-request -> setpw-confirm
export default function Login({ onDone }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', password: '', code: '' });
  const [challengeId, setChallengeId] = useState(null);
  const [err, setErr] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const run = (fn) => async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await fn(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  const login = run(async () => {
    const r = await api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } });
    setChallengeId(r.challengeId); setDevCode(r.devCode || ''); setMode('otp');
  });
  const verify = run(async () => {
    await api('/auth/verify', { method: 'POST', body: { challengeId, code: f.code } });
    onDone();
  });
  const requestPw = run(async () => {
    const r = await api('/auth/password/request', { method: 'POST', body: { email: f.email } });
    setChallengeId(r.challengeId); setDevCode(r.devCode || ''); setMode('setpw');
  });
  const resetPw = run(async () => {
    await api('/auth/password/reset', { method: 'POST', body: { challengeId, code: f.code, password: f.password } });
    setF({ ...f, password: '', code: '' }); setMode('login'); setErr('Password set. Please sign in.');
  });

  return (
    <div className="card login">
      <h1>Bloom Timesheet</h1>
      {mode === 'login' && (
        <form onSubmit={login}>
          <label>Company email<input type="email" value={f.email} onChange={set('email')} placeholder="name@bloom-india.com" required autoFocus /></label>
          <label>Password<input type="password" value={f.password} onChange={set('password')} required /></label>
          <button disabled={busy}>Continue</button>
          <a href="#" onClick={(e) => { e.preventDefault(); setErr(''); setMode('setpw-request'); }}>First time / forgot password?</a>
        </form>
      )}
      {mode === 'otp' && (
        <form onSubmit={verify}>
          <p>We emailed a 6-digit code to <b>{f.email}</b>.</p>
          {devCode && <p className="hint">Dev mode (no email server): your code is <b>{devCode}</b></p>}
          <label>Verification code<input value={f.code} onChange={set('code')} inputMode="numeric" maxLength={6} required autoFocus /></label>
          <button disabled={busy}>Verify & sign in</button>
        </form>
      )}
      {mode === 'setpw-request' && (
        <form onSubmit={requestPw}>
          <p>Enter your company email and we'll send a code to set your password.</p>
          <label>Company email<input type="email" value={f.email} onChange={set('email')} required autoFocus /></label>
          <button disabled={busy}>Send code</button>
          <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }}>Back</a>
        </form>
      )}
      {mode === 'setpw' && (
        <form onSubmit={resetPw}>
          {devCode && <p className="hint">Dev mode (no email server): your code is <b>{devCode}</b></p>}
          <label>Code from email<input value={f.code} onChange={set('code')} inputMode="numeric" maxLength={6} required autoFocus /></label>
          <label>New password (min 10 chars)<input type="password" value={f.password} onChange={set('password')} minLength={10} required /></label>
          <button disabled={busy}>Set password</button>
        </form>
      )}
      {err && <p className={err.startsWith('Password set') ? 'ok' : 'error'}>{err}</p>}
    </div>
  );
}
