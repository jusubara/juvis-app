'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseAuth } from '@/lib/supabase-auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = getSupabaseAuth();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen grid-bg flex items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg border border-cyan-400/60 flex items-center justify-center bg-cyan-500/10"
              style={{ boxShadow: '0 0 15px rgba(0,212,255,0.3)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-cyan-300" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.357 2.059l.96.38a2.25 2.25 0 001.354.013l.94-.376A2.25 2.25 0 0019.5 8.818V3.186m-9.75-.082A23.9 23.9 0 003 5.25M14.25 3.104A23.9 23.9 0 0121 5.25" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold tracking-[0.3em] text-cyan-300 logo-flicker glow-text font-mono">
              JUVIS
            </h1>
          </div>
          <p className="text-[11px] text-cyan-500/70 tracking-widest font-mono uppercase">
            AUTHENTICATION REQUIRED
          </p>
        </div>

        {/* Login card */}
        <div
          className="bg-[#041824] border border-cyan-500/20 rounded-xl p-6"
          style={{ boxShadow: '0 0 40px rgba(0,212,255,0.05), inset 0 1px 0 rgba(0,212,255,0.1)' }}
        >
          <p className="text-xs font-mono text-cyan-600 tracking-widest mb-5 uppercase">
            &gt; IDENTIFY YOURSELF
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono text-cyan-600 tracking-widest mb-1.5 uppercase">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-[#020c14] border border-cyan-500/20 rounded-lg px-3 py-2.5 text-sm text-cyan-100 font-mono placeholder-cyan-800 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-cyan-600 tracking-widest mb-1.5 uppercase">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[#020c14] border border-cyan-500/20 rounded-lg px-3 py-2.5 text-sm text-cyan-100 font-mono placeholder-cyan-800 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[11px] font-mono text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                ✕ {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/60 rounded-lg text-sm font-mono text-cyan-300 tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: loading ? 'none' : '0 0 15px rgba(0,212,255,0.1)' }}
            >
              {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM →'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[10px] font-mono text-cyan-700">
          JUVIS CORE — PERSONAL USE ONLY
        </p>
      </div>
    </main>
  );
}
