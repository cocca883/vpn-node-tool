'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import { getSupabaseBrowserClientAsync } from '@/lib/supabase-browser';

/* ── Types ── */
interface UserInfo {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
  node_count: number;
  is_admin: boolean;
}

interface Stats {
  totalUsers: number;
  totalNodes: number;
  activeUsers: number;
  bannedUsers: number;
  protocolDistribution: { protocol: string; count: number }[];
  recentNodes: { id: number; node_name: string; protocol: string; created_at: string }[];
}

interface ConfigItem {
  key: string;
  value: string;
  description: string | null;
}

type TabKey = 'users' | 'stats' | 'config';

export default function AdminPage() {
  const router = useRouter();
  const { config, isLoading: configLoading } = useSupabaseConfig();
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<string>('');

  const [activeTab, setActiveTab] = useState<TabKey>('stats');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  /* ── Auth check ── */
  useEffect(() => {
    if (configLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = await getSupabaseBrowserClientAsync();
        const { data: { session: sbSession } } = await supabase.auth.getSession();
        if (!sbSession?.access_token || cancelled) {
          if (!cancelled) router.push('/login');
          return;
        }
        const token = sbSession.access_token;
        setSession(token);
        const r = await fetch('/api/admin/check', { headers: { 'x-session': token } });
        const d = await r.json();
        if (cancelled) return;
        if (d.isAdmin) {
          setIsAdmin(true);
        } else {
          router.push('/');
        }
      } catch {
        if (!cancelled) router.push('/login');
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [configLoading, config, router]);

  /* ── Fetch data ── */
  const fetchUsers = useCallback(async () => {
    setDataLoading(true);
    try {
      const r = await fetch('/api/admin/users', { headers: { 'x-session': session } });
      const d = await r.json();
      if (d.success) setUsers(d.data);
    } finally { setDataLoading(false); }
  }, [session]);

  const fetchStats = useCallback(async () => {
    setDataLoading(true);
    try {
      const r = await fetch('/api/admin/stats', { headers: { 'x-session': session } });
      const d = await r.json();
      if (d.success) setStats(d.data);
    } finally { setDataLoading(false); }
  }, [session]);

  const fetchConfigs = useCallback(async () => {
    setDataLoading(true);
    try {
      const r = await fetch('/api/admin/config', { headers: { 'x-session': session } });
      const d = await r.json();
      if (d.success) setConfigs(d.data);
    } finally { setDataLoading(false); }
  }, [session]);

  useEffect(() => {
    if (!isAdmin || !session) return;
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'stats') fetchStats();
    else if (activeTab === 'config') fetchConfigs();
  }, [activeTab, isAdmin, session, fetchUsers, fetchStats, fetchConfigs]);

  /* ── Actions ── */
  const toggleBan = async (userId: string, banned: boolean) => {
    const r = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session': session },
      body: JSON.stringify({ action: banned ? 'unban' : 'ban' }),
    });
    const d = await r.json();
    if (d.success) fetchUsers();
    else alert(d.error || '操作失败');
  };

  const toggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    const r = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session': session },
      body: JSON.stringify({ action: isCurrentlyAdmin ? 'remove_admin' : 'add_admin' }),
    });
    const d = await r.json();
    if (d.success) fetchUsers();
    else alert(d.error || '操作失败');
  };

  const saveConfig = async (key: string, value: string) => {
    const r = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-session': session },
      body: JSON.stringify({ key, value }),
    });
    const d = await r.json();
    if (d.success) {
      setEditingKey(null);
      fetchConfigs();
    } else {
      alert(d.error || '保存失败');
    }
  };

  /* ── Render ── */
  if (configLoading || authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-cyan-400 text-lg">加载中...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'stats', label: '节点统计' },
    { key: 'users', label: '用户管理' },
    { key: 'config', label: '系统配置' },
  ];

  const protocolColors: Record<string, string> = {
    socks5: 'bg-emerald-500/20 text-emerald-400',
    vmess: 'bg-blue-500/20 text-blue-400',
    vless: 'bg-purple-500/20 text-purple-400',
    trojan: 'bg-amber-500/20 text-amber-400',
    ss: 'bg-rose-500/20 text-rose-400',
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-200 p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-cyan-400">后台管理</h1>
          <p className="text-sm text-slate-400 mt-1">VPN 节点配置管理系统</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-lg bg-slate-800 border border-cyan-500/20 text-slate-300 hover:bg-slate-700 transition-colors text-sm"
        >
          返回首页
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-slate-800/50 text-slate-400 border border-transparent hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {dataLoading && (
        <div className="text-center py-10 text-slate-400">加载中...</div>
      )}

      {!dataLoading && activeTab === 'stats' && stats && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '总用户数', value: stats.totalUsers, color: 'text-cyan-400' },
              { label: '活跃用户', value: stats.activeUsers, color: 'text-emerald-400' },
              { label: '总节点数', value: stats.totalNodes, color: 'text-blue-400' },
              { label: '封禁用户', value: stats.bannedUsers, color: 'text-red-400' },
            ].map(s => (
              <div
                key={s.label}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-cyan-500/10 p-5"
              >
                <div className="text-sm text-slate-400 mb-2">{s.label}</div>
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Protocol distribution */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-cyan-500/10 p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">协议分布</h3>
            {stats.protocolDistribution.length === 0 ? (
              <p className="text-slate-500 text-sm">暂无数据</p>
            ) : (
              <div className="space-y-3">
                {stats.protocolDistribution.map(p => {
                  const maxCount = Math.max(...stats.protocolDistribution.map(x => x.count), 1);
                  const pct = (p.count / maxCount) * 100;
                  return (
                    <div key={p.protocol} className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${protocolColors[p.protocol] || 'bg-slate-600/20 text-slate-400'}`}>
                        {p.protocol}
                      </span>
                      <div className="flex-1 h-6 bg-slate-900/50 rounded overflow-hidden">
                        <div
                          className="h-full bg-cyan-500/30 rounded transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-300 w-12 text-right">{p.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent nodes */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-cyan-500/10 p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">最近添加的节点</h3>
            {stats.recentNodes.length === 0 ? (
              <p className="text-slate-500 text-sm">暂无数据</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-2 px-3">ID</th>
                      <th className="text-left py-2 px-3">节点名称</th>
                      <th className="text-left py-2 px-3">协议</th>
                      <th className="text-left py-2 px-3">创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentNodes.map(n => (
                      <tr key={n.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-slate-400">{n.id}</td>
                        <td className="py-2 px-3 font-mono">{n.node_name}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${protocolColors[n.protocol] || ''}`}>
                            {n.protocol}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400">{new Date(n.created_at).toLocaleString('zh-CN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!dataLoading && activeTab === 'users' && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-cyan-500/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 bg-slate-900/30">
                  <th className="text-left py-3 px-4">邮箱</th>
                  <th className="text-left py-3 px-4">注册时间</th>
                  <th className="text-left py-3 px-4">最后登录</th>
                  <th className="text-left py-3 px-4">节点数</th>
                  <th className="text-left py-3 px-4">角色</th>
                  <th className="text-left py-3 px-4">状态</th>
                  <th className="text-left py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      暂无用户数据
                    </td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-sm">{u.email}</td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        {new Date(u.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleString('zh-CN')
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded text-xs">
                          {u.node_count}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.is_admin ? (
                          <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-xs">
                            管理员
                          </span>
                        ) : (
                          <span className="bg-slate-600/20 text-slate-400 px-2 py-0.5 rounded text-xs">
                            用户
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {u.banned ? (
                          <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">
                            已封禁
                          </span>
                        ) : (
                          <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs">
                            正常
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleBan(u.id, u.banned)}
                            className={`px-2 py-1 rounded text-xs transition-colors ${
                              u.banned
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            }`}
                          >
                            {u.banned ? '解封' : '封禁'}
                          </button>
                          <button
                            onClick={() => toggleAdmin(u.id, u.is_admin)}
                            className={`px-2 py-1 rounded text-xs transition-colors ${
                              u.is_admin
                                ? 'bg-slate-600/20 text-slate-400 hover:bg-slate-600/30'
                                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                            }`}
                          >
                            {u.is_admin ? '移除管理员' : '设为管理员'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!dataLoading && activeTab === 'config' && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-cyan-500/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 bg-slate-900/30">
                  <th className="text-left py-3 px-4">配置项</th>
                  <th className="text-left py-3 px-4">说明</th>
                  <th className="text-left py-3 px-4">当前值</th>
                  <th className="text-left py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {configs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-500">
                      暂无配置
                    </td>
                  </tr>
                ) : (
                  configs.map(c => (
                    <tr key={c.key} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-cyan-400 text-xs">{c.key}</td>
                      <td className="py-3 px-4 text-slate-400 text-xs">{c.description || '-'}</td>
                      <td className="py-3 px-4">
                        {editingKey === c.key ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="bg-slate-900 border border-cyan-500/30 rounded px-2 py-1 text-sm text-slate-200 w-full"
                            autoFocus
                          />
                        ) : (
                          <span className="font-mono text-slate-200">{c.value}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingKey === c.key ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveConfig(c.key, editValue)}
                              className="px-3 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingKey(null)}
                              className="px-3 py-1 rounded text-xs bg-slate-600/20 text-slate-400 hover:bg-slate-600/30 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingKey(c.key);
                              setEditValue(c.value);
                            }}
                            className="px-3 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                          >
                            编辑
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
