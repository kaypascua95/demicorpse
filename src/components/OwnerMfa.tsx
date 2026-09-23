import { useEffect, useState, type FormEvent } from 'react';
import { client, errorMessage } from '@/lib/cms';

// Enrollment secrets stay in memory and disappear on verification or unmount.
export default function OwnerMfa() {
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string }[]>([]);
  const [factorId, setFactorId] = useState('');
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    client().auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      if (error) { setError(error.message); return; }
      setFactors(data.totp); setFactorId(data.totp[0]?.id ?? ''); setLoading(false);
    }).catch(error => { if (active) setError(errorMessage(error)); });
    return () => { active = false; };
  }, []);
  async function enroll() {
    setBusy(true); setError('');
    try {
      const { data: existing, error: listError } = await client().auth.mfa.listFactors();
      if (listError) throw listError;
      if (existing.totp.length) {
        setFactors(existing.totp); setFactorId(existing.totp[0].id); return;
      }
      // Remove abandoned setups only; never remove a verified factor.
      for (const factor of existing.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified')) {
        const { error } = await client().auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
      const { data, error } = await client().auth.mfa.enroll({ factorType: 'totp', issuer: 'DemiCorpse', friendlyName: 'DemiCorpse owner' });
      if (error) throw error;
      setFactorId(data.id); setSetup({ qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { error } = await client().auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      setSetup(null); setCode(''); // Auth event triggers the parent's backend access check.
    } catch (error) { setError(errorMessage(error)); setCode(''); } finally { setBusy(false); }
  }
  return <section className="cms-login">
    <h2>{factors.length ? 'One more key.' : 'Protect your archive.'}</h2>
    <p className="cms-muted">Your authenticator is required before opening drafts or publishing.</p>
    {error && <p className="cms-message cms-error" role="alert">{error}</p>}
    {loading ? <p role="status">Checking your authenticator…</p> : <>
      {!factors.length && !setup && <><p>Connect an authenticator app, then enter its six-digit code. Keep a secure backup in your authenticator app in case you lose your phone.</p><button className="cms-button cms-primary" disabled={busy} onClick={() => void enroll()}>Set up authenticator</button></>}
      {setup && <div className="cms-mfa-setup"><p>Scan this code with your authenticator app.</p><img className="cms-mfa-qr" src={setup.qr} alt="Authenticator setup QR code" /><details><summary>Enter the setup key manually</summary><code>{setup.secret}</code></details><p className="cms-muted">Keep this key private. It disappears after verification.</p></div>}
      {(factors.length > 0 || setup) && <form onSubmit={verify}>
        {factors.length > 1 && <label className="cms-field">Authenticator<select value={factorId} onChange={event => setFactorId(event.target.value)}>{factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}</select></label>}
        <label className="cms-field">Authenticator code<input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label>
        <button className="cms-button cms-primary" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and open archive'}</button>
      </form>}
    </>}
    <p className="cms-muted">Lost your authenticator? Recovery requires your Supabase project administrator. There is no password-only bypass.</p>
    <button className="cms-text-button" disabled={busy} onClick={async () => {
      setBusy(true); const { error } = await client().auth.signOut();
      if (error) { setError(error.message); setBusy(false); }
    }}>Sign out</button>
  </section>;
}
