'use client';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function Account({ onUser }: { onUser: (u: User | null) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); onUser(data.session?.user ?? null); });
    const { data } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY') setRecovery(true);
      setUser(s?.user ?? null); onUser(s?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supabase) return <p className="mut">Accounts are not configured. Add the Supabase URL and anon key to enable sign-in and saving.</p>;
  const sb = supabase;
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok = '') => { const { error } = await p; setMsg(error ? error.message : ok); };

  if (recovery) return (
    <form className="loc" onSubmit={(e) => { e.preventDefault(); run(sb.auth.updateUser({ password: pw }), 'Password updated.').then(() => setRecovery(false)); }}>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" aria-label="New password" minLength={6} required />
      <button className="btn" type="submit">Set new password</button>{msg && <p className="msg">{msg}</p>}
    </form>
  );
  if (user) return (
    <div className="loc"><span>Signed in as {user.email}</span><button className="btn ghost" onClick={() => sb.auth.signOut()}>Sign out</button></div>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(sb.auth.signInWithPassword({ email, password: pw })); }}>
      <div className="loc">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" required />
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" aria-label="Password" minLength={6} />
      </div>
      <div className="cta" style={{ marginTop: 10 }}>
        <button className="btn" type="submit">Sign in</button>
        <button className="btn ghost" type="button" onClick={() => run(sb.auth.signUp({ email, password: pw }), 'Account created. Check your email if confirmation is required.')}>Create account</button>
        <button className="btn ghost" type="button" onClick={() => run(sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin }), 'Password reset email sent.')}>Forgot password</button>
        {process.env.NEXT_PUBLIC_GOOGLE_AUTH === 'true' && (
          <button className="btn ghost" type="button" onClick={() => run(sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }))}>Continue with Google</button>
        )}
      </div>
      {msg && <p className="msg" role="alert">{msg}</p>}
    </form>
  );
}
