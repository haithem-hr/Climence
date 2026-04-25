import { useCallback, useState } from 'react';
import type { AuthUser } from '@climence/shared';
import { login } from '../api/client';
import { saveAuthSession } from '../lib/auth-session';
import climenceLogo from '../assets/climence-logo.png';

interface AuthSession {
  token: string;
  user: AuthUser;
}

interface AuthScreenProps {
  onLogin: (session: AuthSession) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [email, setEmail] = useState('analyst@mewa.gov.sa');
  const [password, setPassword] = useState('Analyst123!');
  const [state, setState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleLogin = useCallback(() => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      setState('error');
      return;
    }

    setState('submitting');
    setError('');
    login({ email: email.trim().toLowerCase(), password })
      .then(session => {
        saveAuthSession(session);
        onLogin(session);
      })
      .catch(() => {
        setError('Incorrect email or password.');
        setState('error');
      });
  }, [email, password, onLogin]);

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={climenceLogo} alt="Climence logo" className="auth-logo" />
          <div>
            <div className="auth-title">Climence</div>
            <div className="auth-sub">Secure Access · MEWA</div>
          </div>
        </div>

        <h1>Sign in to dashboard</h1>
        <p className="auth-copy">
          Use your ministry credentials to access real-time monitoring, analytics, and reporting.
        </p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={event => {
            setEmail(event.target.value);
            if (state === 'error') setState('idle');
          }}
          placeholder="analyst@mewa.gov.sa"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={event => {
            setPassword(event.target.value);
            if (state === 'error') setState('idle');
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') handleLogin();
          }}
          placeholder="••••••••"
        />

        {state === 'error' && <div className="auth-error">{error}</div>}

        <button className="btn primary auth-submit" onClick={handleLogin} disabled={state === 'submitting'}>
          {state === 'submitting' ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="auth-hint">
          Demo accounts: <code>admin@mewa.gov.sa</code>, <code>analyst@mewa.gov.sa</code>, <code>viewer@mewa.gov.sa</code>
        </div>
      </div>
    </div>
  );
}
