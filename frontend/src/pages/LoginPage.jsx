import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import toast from '../utils/toast';
import { apiFetch } from '../utils/api';


const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot password states
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotToken, setForgotToken] = useState('');

  // Reset password states
  const [showReset, setShowReset] = useState(false);
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await login(email, password);
      toast.success('Successfully logged in!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
      toast.error(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError('Please enter your email address');
      return;
    }

    setForgotError('');
    setForgotSuccess('');

    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request reset');

      setForgotSuccess('If registered, a reset code was generated.');
      setForgotToken(data.token); // return in dev so users can copy
      toast.success('Reset code generated successfully');
    } catch (err) {
      setForgotError(err.message);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetTokenInput || !newPassword) {
      setForgotError('Please enter both the reset code and the new password');
      return;
    }

    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetTokenInput, password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');


      setResetSuccess('Password reset successfully. You can now login.');
      toast.success('Password reset completed');
      setTimeout(() => {
        setShowReset(false);
        setShowForgot(false);
        setResetSuccess('');
        setForgotToken('');
        setForgotEmail('');
      }, 3000);
    } catch (err) {
      setForgotError(err.message);
    }
  };

  return (
    <div className="container-md flex justify-center items-center py-8 sm:py-12 px-4" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="card w-full max-w-md p-6 sm:p-8 animate-fade-in">
        <h2 className="text-center font-display font-bold mb-2 text-[var(--text-primary)]">Welcome Back</h2>
        <p className="text-center text-xs text-[var(--text-secondary)] mb-6">Access your legal document demystifier tools</p>

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center gap-2 mb-4 text-xs font-semibold">
            <AlertCircle size={16} className="shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="form-group mb-0">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div className="relative">
              <input
                id="email"
                type="email"
                className="form-input has-icon-left"
                placeholder="name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Mail size={18} className="input-icon-left" />
            </div>
          </div>

          <div className="form-group mb-0">
            <div className="flex justify-between items-center mb-2">
              <label className="form-label mb-0" htmlFor="password">Password</label>
              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotError(''); setForgotSuccess(''); }}
                className="text-xs text-[var(--primary)] hover:underline font-semibold focus:outline-none"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input has-icon-both"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Lock size={18} className="input-icon-left" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="input-icon-right"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full mt-2 flex items-center justify-center gap-2"
            disabled={submitting}
          >
            {submitting ? 'Signing In...' : 'Sign In'} <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-center text-xs text-[var(--text-secondary)] mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-[var(--primary)] hover:underline font-semibold">
            Register for free
          </Link>
        </p>
      </div>

      {/* Forgot Password / Reset Password Modal */}
      {showForgot && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Reset Password</h3>
              <button onClick={() => setShowForgot(false)} className="modal-close">×</button>
            </div>
            
            {forgotError && (
              <div className="p-3 bg-red-100 text-red-800 rounded flex items-center gap-2 mb-4 text-xs font-semibold">
                <AlertCircle size={16} />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="p-3 bg-green-100 text-green-800 rounded flex items-center gap-2 mb-4 text-xs font-semibold">
                <CheckCircle size={16} />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {resetSuccess && (
              <div className="p-3 bg-green-100 text-green-800 rounded flex items-center gap-2 mb-4 text-xs font-semibold">
                <CheckCircle size={16} />
                <span>{resetSuccess}</span>
              </div>
            )}

            {!showReset ? (
              <form onSubmit={handleForgotSubmit}>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  Enter your email address and we will generate a password reset code.
                </p>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="name@company.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                  />
                </div>

                {forgotToken && (
                  <div className="p-3 bg-blue-50 text-blue-800 rounded mb-4 text-xs border border-blue-200">
                    <p className="font-bold mb-1">Development Reset Code (Copy this):</p>
                    <code className="bg-white p-1 rounded font-mono select-all block text-center text-sm font-semibold">{forgotToken}</code>
                  </div>
                )}

                <div className="flex gap-3 justify-end mt-6">
                  {forgotToken && (
                    <button
                      type="button"
                      onClick={() => setShowReset(true)}
                      className="btn btn-secondary btn-sm"
                    >
                      Enter Code
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary btn-sm">Generate Code</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit}>
                <div className="form-group">
                  <label className="form-label">Reset Code</label>
                  <input
                    type="text"
                    className="form-input font-mono text-center font-bold text-lg"
                    placeholder="Reset Code"
                    value={resetTokenInput}
                    onChange={e => setResetTokenInput(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-password">New Password</label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      className="form-input has-icon-right"
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="input-icon-right"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setShowReset(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">Reset Password</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
