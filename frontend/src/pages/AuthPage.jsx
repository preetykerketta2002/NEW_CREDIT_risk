import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loginUser, registerUser } from '../services/api';

export default function AuthPage({ mode = 'login', onSuccess }) {
  const isRegister = mode === 'register';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = isRegister
        ? await registerUser({ full_name: fullName, email, password })
        : await loginUser({ email, password });
      onSuccess(user);
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Unable to sign in right now. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <Link className="auth-brand" to="/login">
        <span className="sidebar-brand-mark">C</span>
        <span><strong>Credence</strong><small>RISK INTELLIGENCE</small></span>
      </Link>

      <section className="auth-layout">
        <div className="auth-intro motion-rise">
          <span className="landing-eyebrow"><i /> PRIVATE PORTFOLIO WORKSPACE</span>
          <h1>{isRegister ? <>Create your<br /><span>workspace account.</span></> : <>Your portfolio,<br /><span>in clear focus.</span></>}</h1>
          <p>Sign in to review borrower details, saved searches, and credit risk assessments.</p>
          <div className="auth-feature-list">
            <span><i>✓</i> Borrower portfolio and assessments</span>
            <span><i>✓</i> Search history saved to your account</span>
          </div>
        </div>

        <form className="auth-card motion-rise motion-delay-one" onSubmit={submit}>
          <div className="auth-card-heading">
            <span className="eyebrow">{isRegister ? 'GET STARTED' : 'WELCOME BACK'}</span>
            <h2>{isRegister ? 'Create account' : 'Sign in'}</h2>
            <p>{isRegister ? 'Create an account to access the workspace.' : 'Enter your email and password to continue.'}</p>
          </div>

          {isRegister && (
            <label className="auth-field">
              <span>Full name</span>
              <input type="text" autoComplete="name" required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" />
            </label>
          )}
          <label className="auth-field">
            <span>Email address</span>
            <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? 'At least 12 characters' : 'Enter your password'} />
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <span aria-hidden="true">→</span>
          </button>
          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to Credence?'}{' '}
            <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
          </p>
          {isRegister && <p className="auth-security-note">Use a unique password of at least 12 characters.</p>}
        </form>
      </section>
      <footer className="auth-footer"><span>Credence Risk Intelligence</span><span>Secure workspace</span></footer>
    </main>
  );
}
