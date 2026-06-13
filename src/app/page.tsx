'use client';

import { useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getSupabaseBrowserClientAsync } from '@/lib/supabase-browser';
import type { Session, User } from '@supabase/supabase-js';

// ==================== Types ====================
interface VpnNode {
  id: number;
  protocol: string;
  address: string;
  port: number;
  account: string;
  password: string;
  node_name: string;
  encryption: string;
  network: string;
  tls: string;
  sni: string;
  path: string;
  host: string;
  alter_id: number;
  expiry_date: string;
  region: string;
  sort_order: number;
}

interface NodeForm {
  protocol: string;
  address: string;
  port: string;
  account: string;
  password: string;
  nodeName: string;
  encryption: string;
  network: string;
  tls: string;
  sni: string;
  path: string;
  host: string;
  expiryDate: string;
  region: string;
}

const PROTOCOLS = ['socks5', 'ss', 'vmess', 'vless', 'trojan'];

const initialForm: NodeForm = {
  protocol: 'socks5',
  address: '',
  port: '',
  account: '',
  password: '',
  nodeName: '',
  encryption: 'aes-256-gcm',
  network: 'tcp',
  tls: '',
  sni: '',
  path: '',
  host: '',
  expiryDate: '',
  region: '',
};

// ==================== Sortable Row ====================
function SortableRow({
  node,
  selected,
  onToggleSelect,
  onDelete,
}: {
  node: VpnNode;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: node.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const now = new Date();
  const isExpired = node.expiry_date && new Date(node.expiry_date) < now;
  const isExpiringSoon = !isExpired && node.expiry_date && (new Date(node.expiry_date).getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-cyan-900/20 hover:bg-cyan-950/30 ${isExpired ? 'opacity-50' : ''}`}
    >
      <td className="px-3 py-2.5 text-center w-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(node.id)}
          className="w-4 h-4 rounded border-cyan-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer accent-cyan-500"
        />
      </td>
      <td className="px-3 py-2.5" {...attributes} {...listeners}>
        <span className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-cyan-400 text-lg">⠿</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-900/40 text-cyan-300 uppercase">
          {node.protocol}
        </span>
      </td>
      <td className="px-3 py-2.5 font-mono text-sm text-slate-200">{node.node_name}</td>
      <td className="px-3 py-2.5 text-xs text-slate-300">
        {node.region ? (
          <span className="px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 text-xs">{node.region}</span>
        ) : (
          <span className="text-slate-600">-</span>
        )}
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{node.address}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-slate-400 text-center">{node.port}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-slate-400 max-w-[120px] truncate">{node.account}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-slate-400 max-w-[100px] truncate">{node.password || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-slate-400 text-center">
        {node.expiry_date ? (
          <span className={isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-emerald-400'}>
            {node.expiry_date}
          </span>
        ) : (
          <span className="text-slate-600">-</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        <button
          onClick={() => onDelete(node.id)}
          className="text-red-400 hover:text-red-300 text-sm transition-colors"
          title="删除"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

// ==================== Main Page ====================
export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nodes, setNodes] = useState<VpnNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<NodeForm>(initialForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [generating, setGenerating] = useState<'android' | 'ios' | null>(null);
  const [qrResult, setQrResult] = useState<{ url: string; platform: string; uris: string[] } | null>(null);
  const [smartImportText, setSmartImportText] = useState('');
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  // Auth state - initialize supabase client after config is ready
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;

    getSupabaseBrowserClientAsync()
      .then((supabase) => {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          setSession(s);
          setUser(s?.user ?? null);
          setAuthLoading(false);
          if (s?.access_token) {
            // Check admin status
            fetch('/api/admin/check', { headers: { 'x-session': s.access_token } })
              .then(r => r.json())
              .then(d => setIsAdmin(d.isAdmin === true))
              .catch(() => setIsAdmin(false));
            // Check banned status
            fetch('/api/check-banned', { headers: { 'x-session': s.access_token } })
              .then(r => r.json())
              .then(d => {
                if (d.banned) {
                  supabase.auth.signOut().then(() => {
                    window.location.href = '/login';
                  });
                }
              })
              .catch(() => {});
          }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event: string, s: Session | null) => {
            setSession(s);
            setUser(s?.user ?? null);
            if (s?.access_token) {
              fetch('/api/admin/check', { headers: { 'x-session': s.access_token } })
                .then(r => r.json())
                .then(d => setIsAdmin(d.isAdmin === true))
                .catch(() => setIsAdmin(false));
            } else {
              setIsAdmin(false);
            }
          }
        );
        sub = subscription;
      })
      .catch(() => {
        setAuthLoading(false);
      });

    // Safety timeout: don't stay in loading forever
    const timeout = setTimeout(() => {
      setAuthLoading(false);
    }, 10000);

    return () => {
      sub?.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Fetch nodes
  const fetchNodes = useCallback(async () => {
    if (!session) return;
    try {
      const token = session.access_token;
      const res = await fetch('/api/nodes/list', {
        headers: { 'x-session': token },
      });
      const data = await res.json();
      if (data.success) {
        setNodes(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    }
  }, [session]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = nodes.findIndex(n => n.id === active.id);
    const newIndex = nodes.findIndex(n => n.id === over.id);
    const newNodes = arrayMove(nodes, oldIndex, newIndex);
    setNodes(newNodes);

    try {
      const items = newNodes.map((n, i) => ({ id: n.id, sort_order: i }));
      await fetch('/api/nodes/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session': session!.access_token },
        body: JSON.stringify({ items }),
      });
    } catch {
      fetchNodes();
    }
  };

  // Add node
  const handleAddNode = async () => {
    if (!form.address || !form.port || !form.nodeName) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session': session!.access_token },
        body: JSON.stringify({
          protocol: form.protocol,
          address: form.address,
          port: parseInt(form.port, 10),
          account: form.account,
          password: form.password,
          nodeName: form.nodeName,
          encryption: form.encryption,
          network: form.network,
          tls: form.tls,
          sni: form.sni,
          path: form.path,
          host: form.host,
          expiryDate: form.expiryDate,
          region: form.region,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setForm(initialForm);
        fetchNodes();
      } else {
        alert(data.error || '添加失败');
      }
    } catch {
      alert('添加节点失败');
    } finally {
      setAddLoading(false);
    }
  };

  // Delete node
  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/nodes/${id}`, {
        method: 'DELETE',
        headers: { 'x-session': session!.access_token },
      });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchNodes();
    } catch {
      alert('删除失败');
    }
  };

  // Toggle select
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === nodes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(nodes.map(n => n.id)));
    }
  };

  // Generate subscription
  const handleGenerate = async (platform: 'android' | 'ios') => {
    if (selectedIds.size === 0) {
      alert('请先勾选节点');
      return;
    }
    setGenerating(platform);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session': session!.access_token },
        body: JSON.stringify({
          nodeIds: Array.from(selectedIds),
          platform,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQrResult({ url: data.data.fullUrl, platform, uris: data.data.uris || [] });
      } else {
        alert(data.error || '生成失败');
      }
    } catch {
      alert('生成订阅失败');
    } finally {
      setGenerating(null);
    }
  };

  // Smart import
  const handleSmartImport = async () => {
    if (!smartImportText.trim()) return;
    setImportLoading(true);
    try {
      const res = await fetch('/api/nodes/smart-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session': session!.access_token },
        body: JSON.stringify({ text: smartImportText }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`成功导入 ${data.count} 个节点`);
        setSmartImportText('');
        setShowSmartImport(false);
        fetchNodes();
      } else {
        alert(data.error || '导入失败');
      }
    } catch {
      alert('智能导入失败');
    } finally {
      setImportLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(''), 1500);
    });
  };

  // Logout
  const handleLogout = async () => {
    const supabase = await getSupabaseBrowserClientAsync();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-cyan-400 text-lg">加载中...</div>
      </div>
    );
  }

  // Not logged in - redirect to login
  if (!session || !user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-slate-400">正在跳转到登录页...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-200">
      {/* Header */}
      <header className="border-b border-cyan-900/30 bg-[#0a0f1a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-lg font-semibold tracking-wide">VPN 节点配置工具</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>{user.email}</span>
            {isAdmin && (
              <a href="/admin" className="px-3 py-1 rounded border border-cyan-900/40 text-cyan-400 hover:bg-cyan-950/40 transition-colors text-xs">
                后台管理
              </a>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded border border-cyan-900/40 text-cyan-400 hover:bg-cyan-950/40 transition-colors text-xs"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Row 1: Add Node + Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Add Node Form */}
          <div className="lg:col-span-3 bg-slate-900/50 border border-cyan-900/20 rounded-lg p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-cyan-300 tracking-wide uppercase">添加节点</h2>
              <button
                onClick={() => setShowSmartImport(!showSmartImport)}
                className="text-xs px-3 py-1 rounded border border-cyan-800/50 text-cyan-400 hover:bg-cyan-950/50 transition-colors"
              >
                {showSmartImport ? '手动添加' : '智能导入'}
              </button>
            </div>

            {showSmartImport ? (
              /* Smart Import */
              <div className="space-y-3">
                <textarea
                  value={smartImportText}
                  onChange={(e) => setSmartImportText(e.target.value)}
                  placeholder={"粘贴节点数据，每行一条，支持以下格式：\n\n1. URI格式：socks5://user:pass@1.2.3.4:1080#名称\n2. 竖线分隔：socks5|1.2.3.4|1080|user|pass|到期|名称\n3. 斜杠分隔：socks5/1.2.3.4/1080/user/pass/到期/名称"}
                  className="w-full h-40 bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none resize-none"
                />
                <button
                  onClick={handleSmartImport}
                  disabled={importLoading}
                  className="w-full py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {importLoading ? '识别导入中...' : '智能识别并导入'}
                </button>
              </div>
            ) : (
              /* Manual Form */
              <div className="space-y-3">
                {/* Row 1: Protocol + Address + Port */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">协议类型</label>
                    <select
                      value={form.protocol}
                      onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                      className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 focus:border-cyan-600 focus:outline-none"
                    >
                      {PROTOCOLS.map(p => (
                        <option key={p} value={p}>{p.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">服务器地址</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="1.2.3.4"
                      className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">端口</label>
                    <input
                      type="text"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: e.target.value })}
                      placeholder="443"
                      className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Row 2: Account + Password + NodeName + Expiry */}
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">
                      {form.protocol === 'vmess' || form.protocol === 'vless' ? 'UUID' : '账号'}
                    </label>
                    <input
                      type="text"
                      value={form.account}
                      onChange={(e) => setForm({ ...form, account: e.target.value })}
                      placeholder={form.protocol === 'vmess' || form.protocol === 'vless' ? 'uuid' : '用户名'}
                      className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">密码</label>
                    <input
                      type="text"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="密码"
                      className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">节点名称</label>
                    <input
                      type="text"
                      value={form.nodeName}
                      onChange={(e) => setForm({ ...form, nodeName: e.target.value })}
                      placeholder="东京-01"
                      className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">地区</label>
                    <input
                      type="text"
                      value={form.region}
                      onChange={(e) => setForm({ ...form, region: e.target.value })}
                      placeholder="日本"
                      className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">到期时间</label>
                    <input
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                      className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 focus:border-cyan-600 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Advanced Settings */}
                <div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {showAdvanced ? '▼ 收起高级设置' : '▶ 展开高级设置'}
                  </button>
                </div>

                {showAdvanced && (
                  <div className="space-y-3 border-t border-cyan-900/20 pt-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">加密方式</label>
                        <input
                          type="text"
                          value={form.encryption}
                          onChange={(e) => setForm({ ...form, encryption: e.target.value })}
                          placeholder="aes-256-gcm"
                          className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">传输协议</label>
                        <select
                          value={form.network}
                          onChange={(e) => setForm({ ...form, network: e.target.value })}
                          className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 focus:border-cyan-600 focus:outline-none"
                        >
                          <option value="tcp">tcp</option>
                          <option value="ws">ws</option>
                          <option value="grpc">grpc</option>
                          <option value="h2">h2</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">TLS</label>
                        <select
                          value={form.tls}
                          onChange={(e) => setForm({ ...form, tls: e.target.value })}
                          className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 focus:border-cyan-600 focus:outline-none"
                        >
                          <option value="">无</option>
                          <option value="tls">tls</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">SNI</label>
                        <input
                          type="text"
                          value={form.sni}
                          onChange={(e) => setForm({ ...form, sni: e.target.value })}
                          placeholder="example.com"
                          className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Path</label>
                        <input
                          type="text"
                          value={form.path}
                          onChange={(e) => setForm({ ...form, path: e.target.value })}
                          placeholder="/ws"
                          className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Host</label>
                        <input
                          type="text"
                          value={form.host}
                          onChange={(e) => setForm({ ...form, host: e.target.value })}
                          placeholder="example.com"
                          className="w-full bg-slate-800/50 border border-cyan-900/30 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-600 focus:outline-none font-mono"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => setShowAdvanced(false)}
                          className="w-full py-2 rounded border border-cyan-900/40 text-slate-400 hover:text-cyan-300 text-xs transition-colors"
                        >
                          收起
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Button */}
                <button
                  onClick={handleAddNode}
                  disabled={addLoading || !form.address || !form.port || !form.nodeName}
                  className="w-full py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
                >
                  {addLoading ? '添加中...' : '添加节点'}
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="lg:col-span-2 bg-slate-900/50 border border-cyan-900/20 rounded-lg p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-cyan-300 tracking-wide uppercase mb-3">操作说明</h2>
            <div className="space-y-3 text-sm text-slate-400">
              <div>
                <h3 className="text-cyan-400 font-medium mb-1">1. 添加节点</h3>
                <p>选择协议类型，填写服务器信息后点击添加。支持手动添加和智能导入（支持 URI 格式、竖线/斜杠分隔格式）。</p>
              </div>
              <div>
                <h3 className="text-cyan-400 font-medium mb-1">2. 管理节点</h3>
                <p>在节点列表中可拖拽排序、勾选或删除节点。到期时间已过的节点将显示为半透明。</p>
              </div>
              <div>
                <h3 className="text-cyan-400 font-medium mb-1">3. 生成订阅</h3>
                <p>勾选需要的节点后，点击对应平台按钮生成订阅：</p>
                <ul className="mt-1 ml-4 space-y-1 text-xs list-disc">
                  <li><span className="text-cyan-300">IOS SR订阅</span>：适用于 Shadowrocket，# 替换为 ?remarks=，socks5→socks，中间内容 Base64 编码</li>
                  <li><span className="text-cyan-300">安卓 Neko订阅</span>：适用于 NekoBox，端口后加 /，原始文本存储</li>
                </ul>
              </div>
              <div>
                <h3 className="text-cyan-400 font-medium mb-1">4. 使用二维码</h3>
                <p>生成订阅后自动显示二维码，在对应 APP 中扫描即可导入。订阅链接固定不变，更新后覆盖历史文件。</p>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Node List (full width) */}
        <div className="bg-slate-900/50 border border-cyan-900/20 rounded-lg backdrop-blur-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-cyan-900/20 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-cyan-300 tracking-wide uppercase">
              节点列表
              <span className="text-slate-500 font-normal ml-2">({nodes.length} 个节点)</span>
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-xs text-slate-400 hover:text-cyan-300 transition-colors"
              >
                {selectedIds.size === nodes.length ? '取消全选' : '全选'}
              </button>
              <span className="text-xs text-cyan-400">{selectedIds.size > 0 ? `已选 ${selectedIds.size} 个` : ''}</span>
            </div>
          </div>

          {nodes.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-600 text-sm">
              暂无节点，请添加或智能导入
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-cyan-900/30 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2.5 text-center w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === nodes.length && nodes.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-cyan-700 bg-slate-800 accent-cyan-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-center w-10">排序</th>
                    <th className="px-3 py-2.5 text-center">协议</th>
                    <th className="px-3 py-2.5 text-center">名称</th>
                    <th className="px-3 py-2.5 text-center">地区</th>
                    <th className="px-3 py-2.5 text-center">地址</th>
                    <th className="px-3 py-2.5 text-center">端口</th>
                    <th className="px-3 py-2.5 text-center">账号</th>
                    <th className="px-3 py-2.5 text-center">密码</th>
                    <th className="px-3 py-2.5 text-center">到期</th>
                    <th className="px-3 py-2.5 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={nodes.map(n => n.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {nodes.map(node => (
                        <SortableRow
                          key={node.id}
                          node={node}
                          selected={selectedIds.has(node.id)}
                          onToggleSelect={toggleSelect}
                          onDelete={handleDelete}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Row 3: Generate Buttons + QR Code */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generate Buttons */}
          <div className="bg-slate-900/50 border border-cyan-900/20 rounded-lg p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-cyan-300 tracking-wide uppercase mb-4">生成订阅</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleGenerate('ios')}
                disabled={generating !== null || selectedIds.size === 0}
                className="py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:hover:from-cyan-600 disabled:hover:to-blue-600 text-white text-sm font-medium transition-all"
              >
                {generating === 'ios' ? '生成中...' : 'IOS SR 订阅'}
              </button>
              <button
                onClick={() => handleGenerate('android')}
                disabled={generating !== null || selectedIds.size === 0}
                className="py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:hover:from-emerald-600 disabled:hover:to-teal-600 text-white text-sm font-medium transition-all"
              >
                {generating === 'android' ? '生成中...' : '安卓 Neko 订阅'}
              </button>
            </div>
            {selectedIds.size === 0 && (
              <p className="mt-3 text-xs text-slate-600 text-center">请先在列表中勾选节点</p>
            )}
          </div>

          {/* QR Code Result */}
          <div className="bg-slate-900/50 border border-cyan-900/20 rounded-lg p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-cyan-300 tracking-wide uppercase mb-4">订阅二维码</h2>
            {qrResult ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-3 rounded-lg animate-in fade-in duration-300">
                  <QRCodeSVG
                    value={qrResult.url}
                    size={180}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0">平台：</span>
                    <span className={`text-xs font-medium ${qrResult.platform === 'ios' ? 'text-cyan-400' : 'text-emerald-400'}`}>
                      {qrResult.platform === 'ios' ? 'IOS Shadowrocket' : '安卓 NekoBox'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0">链接：</span>
                    <span className="text-xs font-mono text-slate-300 break-all flex-1">{qrResult.url}</span>
                    <button
                      onClick={() => copyToClipboard(qrResult.url, '链接')}
                      className={`shrink-0 text-xs px-2 py-1 rounded transition-colors ${
                        copyFeedback === '链接'
                          ? 'bg-emerald-900/50 text-emerald-300'
                          : 'bg-slate-800 text-slate-400 hover:text-cyan-300'
                      }`}
                    >
                      {copyFeedback === '链接' ? '已复制' : '复制'}
                    </button>
                  </div>
                  {qrResult.uris.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500">节点链接（{qrResult.uris.length} 条）：</span>
                        <button
                          onClick={() => copyToClipboard(qrResult.uris.join('\n'), '节点链接')}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            copyFeedback === '节点链接'
                              ? 'bg-emerald-900/50 text-emerald-300'
                              : 'bg-slate-800 text-slate-400 hover:text-cyan-300'
                          }`}
                        >
                          {copyFeedback === '节点链接' ? '已复制' : '复制全部'}
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto bg-slate-950/50 rounded-lg border border-slate-800/50 p-3 space-y-1.5">
                        {qrResult.uris.map((uri, i) => (
                          <div key={i} className="text-xs font-mono text-slate-400 break-all leading-relaxed">
                            <span className="text-cyan-600 select-none mr-1.5">{i + 1}.</span>
                            {uri}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-600 text-sm py-8">
                选择节点并点击生成按钮后，二维码将在此显示
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
