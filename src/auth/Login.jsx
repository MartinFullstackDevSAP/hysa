import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { supabase } from '../supabaseClient';
import '../css/auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      console.error('Chyba pri prihlasovaní:', signInError.message);
      setError('Nesprávny email alebo heslo.');
    }

    setLoading(false);
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="sidebar-logo-icon">F</div>
          <span>F.I.R.E</span>
        </div>
        <h1>Prihlásenie</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="auth-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <label className="auth-label" htmlFor="login-password">Heslo</label>
          <input
            id="login-password"
            className="auth-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>
            <LogIn size={18} />
            {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
          </button>
        </form>
      </section>
    </main>
  );
}
