import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore.js';
import { api } from '../api/http.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Page 5 — sign in or join, in one form with a mode switch. */
export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from?.pathname || '/loans';
  const adopt = useSessionStore((s) => s.adopt);

  const [mode, setMode] = useState('signin');
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const joining = mode === 'join';
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function validate() {
    const found = {};
    if (joining) {
      const name = values.name.trim();
      if (!name) found.name = 'Tell us what to call you.';
      else if (name.length < 2) found.name = 'That is a little short for a name.';
    }
    if (!values.email.trim()) found.email = 'Email address is required.';
    else if (!EMAIL.test(values.email.trim())) found.email = 'That does not look like an email address.';

    if (!values.password) found.password = 'Password is required.';
    else if (joining && values.password.length < 10) {
      found.password = 'Use at least 10 characters — length matters more than symbols.';
    }
    return found;
  }

  async function submit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    setFormError('');
    try {
      const session = await api(joining ? '/auth/signup' : '/auth/login', {
        method: 'POST',
        body: joining
          ? { name: values.name.trim(), email: values.email.trim(), password: values.password }
          : { email: values.email.trim(), password: values.password },
      });
      adopt(session);
      navigate(destination, { replace: true });
    } catch (err) {
      // The server is the authority — its per-field messages overwrite ours.
      if (err.fields) setErrors((prev) => ({ ...prev, ...err.fields }));
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="u-shell gate">
      <form className="panel gate__card" onSubmit={submit} noValidate>
        <p className="eyebrow">{joining ? 'New member' : 'Members'}</p>
        <h1 className="gate__title">{joining ? 'Join the shed.' : 'Sign in.'}</h1>
        {location.state?.from && (
          <p className="gate__body">Sign in to reach {location.state.from.pathname}.</p>
        )}

        {formError && <p className="alert" role="alert">{formError}</p>}

        {joining && (
          <label className="field">
            <span className="field__label">Your name</span>
            <input className="input" value={values.name} onChange={set('name')}
                   autoComplete="name" aria-invalid={!!errors.name} disabled={busy} />
            {errors.name && <span className="field__error">{errors.name}</span>}
          </label>
        )}

        <label className="field">
          <span className="field__label">Email address</span>
          <input className="input" type="email" value={values.email} onChange={set('email')}
                 autoComplete="email" aria-invalid={!!errors.email} disabled={busy} />
          {errors.email && <span className="field__error">{errors.email}</span>}
        </label>

        <label className="field">
          <span className="field__label">Password</span>
          <input className="input" type="password" value={values.password} onChange={set('password')}
                 autoComplete={joining ? 'new-password' : 'current-password'}
                 aria-invalid={!!errors.password} disabled={busy} />
          {errors.password
            ? <span className="field__error">{errors.password}</span>
            : joining ? <span className="field__hint">At least 10 characters, with a number.</span> : null}
        </label>

        <button className="btn btn--tape gate__submit" type="submit" disabled={busy}>
          {busy && <span className="spinner" />}
          {busy ? (joining ? 'Creating your account…' : 'Signing in…') : (joining ? 'Create account' : 'Sign in')}
        </button>

        <p className="gate__foot">
          {joining ? 'Already a member? ' : 'No account yet? '}
          <button type="button" className="linkish"
                  onClick={() => { setMode(joining ? 'signin' : 'join'); setErrors({}); setFormError(''); }}>
            {joining ? 'Sign in' : 'Join the shed'}
          </button>
        </p>

        <p className="gate__demo">
          Demo logins — keeper <code>ada@toolshed.test</code>, member <code>sam@toolshed.test</code>,
          both <code>shed-ladder-9912</code>.
        </p>
      </form>
    </div>
  );
}
