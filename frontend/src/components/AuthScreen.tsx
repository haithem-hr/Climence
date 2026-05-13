import { useCallback, useState } from 'react';
import { Languages } from 'lucide-react';
import type { AuthUser } from '@climence/shared';
import { ApiError, login } from '../api/client';
import { saveAuthSession } from '../lib/auth-session';
import { tFormat, translate, type DictKey, type Locale } from '../lib/i18n';
import climenceLogo from '../assets/climence-logo.png';

interface AuthSession {
  token: string;
  user: AuthUser;
}

interface AuthScreenProps {
  onLogin: (session: AuthSession) => void;
  locale: Locale;
  onToggleRtl: () => void;
}

export function AuthScreen({ onLogin, locale, onToggleRtl }: AuthScreenProps) {
  const [email, setEmail] = useState('analyst@mewa.gov.sa');
  const [password, setPassword] = useState('Analyst123!');
  const [state, setState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState('');
  const t = useCallback((key: DictKey) => translate(key, locale), [locale]);

  const handleLogin = useCallback(() => {
    if (!email.trim() || !password.trim()) {
      setError(t('auth.required'));
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
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.status === 429) {
            if (err.retryAfterSec) {
              setError(tFormat('auth.rateLimitedWait', locale, { minutes: Math.ceil(err.retryAfterSec / 60) }));
            } else {
              setError(t('auth.rateLimited'));
            }
          } else if (err.status === 401) {
            setError(t('auth.invalid'));
          } else {
            setError(tFormat('auth.failed', locale, { message: err.message }));
          }
        } else {
          setError(t('auth.offline'));
        }
        setState('error');
      });
  }, [email, password, onLogin, locale, t]);

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={climenceLogo} alt="Climence logo" className="auth-logo" />
          <div>
            <div className="auth-title">Climence</div>
            <div className="auth-sub">{t('auth.secureAccess')}</div>
          </div>
          <button className="icon-btn" onClick={onToggleRtl} aria-label={t('app.toggleDirection')} title={t('app.toggleDirection')}>
            <Languages size={14} />
          </button>
        </div>

        <h1>{t('auth.title')}</h1>
        <p className="auth-copy">{t('auth.subtitle')}</p>

        <label htmlFor="email">{t('auth.email')}</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={event => {
            setEmail(event.target.value);
            if (state === 'error') setState('idle');
          }}
          placeholder={t('auth.email')}
        />

        <label htmlFor="password">{t('auth.password')}</label>
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
          placeholder={t('auth.password')}
        />

        {state === 'error' && <div className="auth-error" role="alert">{error}</div>}

        <button className="btn primary auth-submit" onClick={handleLogin} disabled={state === 'submitting'}>
          {state === 'submitting' ? t('auth.submitting') : t('auth.submit')}
        </button>

        <div className="auth-hint">
          {t('auth.demoAccounts')}: <code>admin@mewa.gov.sa</code>, <code>analyst@mewa.gov.sa</code>, <code>viewer@mewa.gov.sa</code>
        </div>
      </div>
    </div>
  );
}
