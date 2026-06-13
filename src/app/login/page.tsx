'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { Shield, Eye, EyeOff, Loader2, Mail, Lock, UserPlus } from 'lucide-react';

type AuthMode = 'login' | 'register';

const APP_ICON = 'https://coze-coding-project.tos.coze.site/default/project_default_icon_3.svg?sign=4903428653-7089c330d9-0-d30129f876d555072db7a5f74306a6203bd955be0358c6492581d5419be0d8cb';
const APP_NAME = 'VPN节点记录网站';

export default function LoginPage() {
  const { isLoading: configLoading } = useSupabaseConfig();
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      try {
        const supabase = await getSupabaseBrowserClientWithRetry();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.replace('/');
        }
      } catch {
        // Not logged in, stay on login page
      }
    };
    if (!configLoading) {
      checkSession();
    }
  }, [configLoading, router]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) {
        if (loginError.message.includes('Invalid login credentials')) {
          setError('邮箱或密码错误');
        } else {
          setError(loginError.message);
        }
        return;
      }
      // Check if user is banned
      if (data.session) {
        const res = await fetch('/api/admin/check', {
          headers: { 'x-session': data.session.access_token },
        });
        const checkData = await res.json();
        // If check fails (not admin), we still need to verify banned status
        // Use the banned-check API
        const banRes = await fetch('/api/check-banned', {
          headers: { 'x-session': data.session.access_token },
        });
        const banData = await banRes.json();
        if (banData.banned) {
          await supabase.auth.signOut();
          setError('该账号已被封禁');
          return;
        }
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码长度至少6位');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data, error: registerError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (registerError) {
        if (registerError.message.includes('already registered')) {
          setError('该邮箱已注册，请直接登录');
        } else {
          setError(registerError.message);
        }
        return;
      }
      // auto_confirm is true, so user is logged in immediately
      if (data.session) {
        router.replace('/');
      } else {
        setMode('login');
        setError('注册成功，请登录');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      handleLogin();
    } else {
      handleRegister();
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-200 relative flex items-center justify-center px-4">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* App Icon & Name */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mb-4 bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Image
              src={APP_ICON}
              alt={APP_NAME}
              width={64}
              height={64}
              className="object-contain"
              unoptimized
            />
          </div>
          <h1 className="text-xl font-bold text-slate-200">{APP_NAME}</h1>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border border-cyan-500/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
          {/* Tab Switch */}
          <div className="flex border-b border-slate-700/50">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                登录
              </span>
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                注册
              </span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少6位密码"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">确认密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/25 hover:border-cyan-500/40"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                <Shield className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {mode === 'login' ? '登录' : '注册'}
            </button>

            {/* Switch mode link */}
            <p className="text-center text-xs text-slate-500">
              {mode === 'login' ? (
                <>
                  还没有账号？
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(null); }}
                    className="text-cyan-400 hover:text-cyan-300 ml-1"
                  >
                    去注册
                  </button>
                </>
              ) : (
                <>
                  已有账号？
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); }}
                    className="text-cyan-400 hover:text-cyan-300 ml-1"
                  >
                    去登录
                  </button>
                </>
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
