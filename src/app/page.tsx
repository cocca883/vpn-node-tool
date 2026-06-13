'use client';

import { useState, useEffect, useCallback } from 'react';
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
import {
  Shield,
  Plus,
  Trash2,
  Copy,
  Check,
  Server,
  Globe,
  Hash,
  KeyRound,
  User,
  FileText,
  QrCode,
  Link,
  ChevronDown,
  ChevronUp,
  Loader2,
  GripVertical,
  Circle,
  CheckCircle2,
  X,
} from 'lucide-react';

type Protocol = 'ss' | 'vmess' | 'vless' | 'trojan' | 'socks5';

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
  sort_order: number;
  created_at: string;
}

interface NodeForm {
  protocol: Protocol;
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
  alterId: string;
}

interface GenerateResult {
  uris: string[];
  base64: string;
  filename: string;
  urlPath: string;
  fullUrl: string;
}

const protocolLabels: Record<Protocol, string> = {
  ss: 'Shadowsocks',
  vmess: 'VMess',
  vless: 'VLESS',
  trojan: 'Trojan',
  socks5: 'SOCKS5',
};

const protocolColors: Record<Protocol, string> = {
  ss: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  vmess: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  vless: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  trojan: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  socks5: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
};

function emptyForm(): NodeForm {
  return {
    protocol: 'vmess',
    address: '',
    port: '',
    account: '',
    password: '',
    nodeName: '',
    encryption: 'auto',
    network: 'tcp',
    tls: '',
    sni: '',
    path: '',
    host: '',
    alterId: '0',
  };
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${
        copied
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20'
      } ${className || ''}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? '已复制' : '复制'}
    </button>
  );
}

// Sortable node list item
function SortableNodeItem({
  node,
  isSelected,
  onToggleSelect,
  onDelete,
}: {
  node: VpnNode;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const proto = node.protocol as Protocol;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-200 ${
        isDragging
          ? 'bg-slate-800/80 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
          : 'bg-slate-800/40 border-slate-700/30 hover:border-cyan-500/20'
      }`}
    >
      {/* Drag handle */}
      <button
        className="p-1 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Checkbox */}
      <button onClick={() => onToggleSelect(node.id)} className="flex-shrink-0">
        {isSelected ? (
          <CheckCircle2 className="w-5 h-5 text-cyan-400" />
        ) : (
          <Circle className="w-5 h-5 text-slate-600 hover:text-slate-400" />
        )}
      </button>

      {/* Protocol badge */}
      <span className={`text-xs font-mono px-2 py-0.5 rounded border ${protocolColors[proto] || 'bg-slate-700/30 text-slate-400'}`}>
        {protocolLabels[proto] || node.protocol}
      </span>

      {/* Node info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">{node.node_name}</div>
        <div className="text-xs text-slate-500 font-mono truncate">
          {node.address}:{node.port}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(node.id)}
        className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function HomePage() {
  const [form, setForm] = useState<NodeForm>(emptyForm());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nodes, setNodes] = useState<VpnNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodesLoading, setNodesLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch nodes on mount
  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/nodes/list');
      const data = await res.json();
      if (data.success) {
        setNodes(data.data);
      }
    } catch (err) {
      console.error('Fetch nodes error:', err);
    } finally {
      setNodesLoading(false);
    }
  };

  const updateForm = (field: keyof NodeForm, value: string) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'protocol') {
        if (value === 'ss') updated.encryption = 'aes-256-gcm';
        else if (value === 'vmess') { updated.encryption = 'auto'; updated.alterId = '0'; }
        else if (value === 'vless') updated.encryption = 'none';
        else if (value === 'trojan') updated.tls = 'tls';
        else if (value === 'socks5') updated.encryption = '';
      }
      return updated;
    });
  };

  const handleAddNode = async () => {
    if (!form.address || !form.port || !form.nodeName) {
      setError('请填写服务器地址、端口和节点名称');
      return;
    }
    setError(null);
    setAddLoading(true);
    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          alterId: parseInt(form.alterId, 10) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '添加失败');
        return;
      }
      setForm(emptyForm());
      setShowAdvanced(false);
      await fetchNodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await fetchNodes();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = nodes.findIndex((n) => n.id === active.id);
    const newIndex = nodes.findIndex((n) => n.id === over.id);
    const reordered = arrayMove(nodes, oldIndex, newIndex);
    setNodes(reordered);

    // Persist new order
    const items = reordered.map((n, i) => ({ id: n.id, sort_order: i }));
    try {
      await fetch('/api/nodes/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
    } catch (err) {
      console.error('Reorder error:', err);
      await fetchNodes();
    }
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) {
      setError('请至少选择一个节点');
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '生成失败');
        return;
      }
      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-200 relative">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              VPN 节点配置工具
            </h1>
          </div>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            输入节点信息，自动生成协议链接，Base64 编码后保存为订阅文件，并生成可扫描的二维码
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Add Form + Node List */}
          <div className="space-y-6">
            {/* Add Node Form */}
            <div className="rounded-xl border border-cyan-500/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-cyan-500/10">
                <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  添加节点
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {/* Protocol + Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">协议类型</label>
                    <select
                      value={form.protocol}
                      onChange={(e) => updateForm('protocol', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                    >
                      {Object.entries(protocolLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">节点名称</label>
                    <input
                      type="text"
                      value={form.nodeName}
                      onChange={(e) => updateForm('nodeName', e.target.value)}
                      placeholder="如：东京-01"
                      className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>

                {/* Address + Port */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> 服务器地址
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => updateForm('address', e.target.value)}
                      placeholder="IP 或域名"
                      className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                      <Hash className="w-3 h-3" /> 端口
                    </label>
                    <input
                      type="number"
                      value={form.port}
                      onChange={(e) => updateForm('port', e.target.value)}
                      placeholder="443"
                      className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>

                {/* Account + Password */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {form.protocol === 'ss' ? '加密方式' : form.protocol === 'vmess' || form.protocol === 'vless' ? 'UUID' : '账号'}
                    </label>
                    <input
                      type="text"
                      value={form.account}
                      onChange={(e) => updateForm('account', e.target.value)}
                      placeholder={form.protocol === 'ss' ? 'aes-256-gcm' : form.protocol === 'vmess' || form.protocol === 'vless' ? 'UUID' : '账号'}
                      className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                      <KeyRound className="w-3 h-3" /> 密码
                    </label>
                    <input
                      type="text"
                      value={form.password}
                      onChange={(e) => updateForm('password', e.target.value)}
                      placeholder="密码"
                      className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>

                {/* Advanced toggle */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-1"
                >
                  {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  高级设置
                </button>

                {showAdvanced && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">加密方式</label>
                      <input
                        type="text"
                        value={form.encryption}
                        onChange={(e) => updateForm('encryption', e.target.value)}
                        placeholder="auto"
                        className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">传输协议</label>
                      <select
                        value={form.network}
                        onChange={(e) => updateForm('network', e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                      >
                        <option value="tcp">TCP</option>
                        <option value="ws">WebSocket</option>
                        <option value="grpc">gRPC</option>
                        <option value="h2">HTTP/2</option>
                        <option value="quic">QUIC</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">TLS</label>
                      <select
                        value={form.tls}
                        onChange={(e) => updateForm('tls', e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                      >
                        <option value="">关闭</option>
                        <option value="tls">TLS</option>
                        <option value="reality">Reality</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">SNI</label>
                      <input
                        type="text"
                        value={form.sni}
                        onChange={(e) => updateForm('sni', e.target.value)}
                        placeholder="域名"
                        className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Path</label>
                      <input
                        type="text"
                        value={form.path}
                        onChange={(e) => updateForm('path', e.target.value)}
                        placeholder="/path"
                        className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Host</label>
                      <input
                        type="text"
                        value={form.host}
                        onChange={(e) => updateForm('host', e.target.value)}
                        placeholder="域名"
                        className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                      />
                    </div>
                    {form.protocol === 'vmess' && (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Alter ID</label>
                        <input
                          type="number"
                          value={form.alterId}
                          onChange={(e) => updateForm('alterId', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Add button */}
                <button
                  onClick={handleAddNode}
                  disabled={addLoading}
                  className="w-full py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/25 hover:border-cyan-500/40"
                >
                  {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  添加到列表
                </button>
              </div>
            </div>

            {/* Node List */}
            <div className="rounded-xl border border-cyan-500/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-cyan-500/10 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  节点列表
                  <span className="text-xs font-normal text-slate-500">({nodes.length})</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedIds.size === nodes.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(nodes.map((n) => n.id)));
                    }}
                    className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                  >
                    {selectedIds.size === nodes.length && nodes.length > 0 ? '取消全选' : '全选'}
                  </button>
                </div>
              </div>
              <div className="p-4">
                {nodesLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-500">加载中...</p>
                  </div>
                ) : nodes.length === 0 ? (
                  <div className="text-center py-8">
                    <Server className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">暂无节点，请添加</p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={nodes.map((n) => n.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {nodes.map((node) => (
                          <SortableNodeItem
                            key={node.id}
                            node={node}
                            isSelected={selectedIds.has(node.id)}
                            onToggleSelect={handleToggleSelect}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              {/* Generate Button */}
              {nodes.length > 0 && (
                <div className="px-4 pb-4">
                  <button
                    onClick={handleGenerate}
                    disabled={loading || selectedIds.size === 0}
                    className="w-full py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/25 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4" />
                        生成订阅 ({selectedIds.size} 个节点)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-4">
            {!result ? (
              <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-900/30 backdrop-blur-sm p-12 text-center">
                <QrCode className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">
                  选择节点后点击生成，结果将在此展示
                </p>
              </div>
            ) : (
              <>
                {/* Node URIs */}
                <div className="rounded-xl border border-cyan-500/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-cyan-500/10 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Link className="w-4 h-4 text-cyan-400" />
                      节点链接
                    </h3>
                    <CopyButton text={result.uris.join('\n')} />
                  </div>
                  <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                    {result.uris.map((uri, i) => (
                      <div key={i} className="text-xs font-mono text-slate-400 bg-slate-800/50 p-2.5 rounded-lg break-all">
                        {uri}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Base64 */}
                <div className="rounded-xl border border-cyan-500/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-cyan-500/10 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      Base64 编码结果
                    </h3>
                    <CopyButton text={result.base64} />
                  </div>
                  <div className="p-4">
                    <div className="text-xs font-mono text-slate-400 bg-slate-800/50 p-2.5 rounded-lg break-all max-h-36 overflow-y-auto">
                      {result.base64}
                    </div>
                  </div>
                </div>

                {/* File URL */}
                <div className="rounded-xl border border-cyan-500/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-cyan-500/10 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      订阅文件路径
                    </h3>
                    <CopyButton text={result.fullUrl} />
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-mono text-cyan-400 bg-slate-800/50 p-3 rounded-lg break-all">
                      {result.fullUrl}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">可在客户端中使用此链接作为订阅地址</p>
                  </div>
                </div>

                {/* QR Code */}
                <div className="rounded-xl border border-cyan-500/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-cyan-500/10 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-cyan-400" />
                      二维码
                    </h3>
                    <button
                      onClick={() => setResult(null)}
                      className="text-xs text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> 关闭
                    </button>
                  </div>
                  <div className="p-6 flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-lg shadow-cyan-500/5">
                      <QRCodeSVG
                        value={result.fullUrl}
                        size={200}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#0a0f1a"
                      />
                    </div>
                    <p className="text-xs text-slate-500 text-center">扫描二维码获取订阅文件地址</p>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        <footer className="mt-12 text-center text-xs text-slate-600">
          VPN 节点配置工具 - 仅用于合法用途
        </footer>
      </div>
    </div>
  );
}
