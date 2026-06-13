'use client';

import { useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
} from 'lucide-react';

type Protocol = 'ss' | 'vmess' | 'vless' | 'trojan';

interface NodeForm {
  id: string;
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

function createEmptyNode(): NodeForm {
  return {
    id: crypto.randomUUID().slice(0, 8),
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

const protocolLabels: Record<Protocol, string> = {
  ss: 'Shadowsocks',
  vmess: 'VMess',
  vless: 'VLESS',
  trojan: 'Trojan',
};

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

export default function HomePage() {
  const [nodes, setNodes] = useState<NodeForm[]>([createEmptyNode()]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([nodes[0].id]));
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateNode = (id: string, field: keyof NodeForm, value: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const updated = { ...n, [field]: value };
        // Auto-adjust defaults when protocol changes
        if (field === 'protocol') {
          if (value === 'ss') {
            updated.encryption = 'aes-256-gcm';
          } else if (value === 'vmess') {
            updated.encryption = 'auto';
            updated.alterId = '0';
          } else if (value === 'vless') {
            updated.encryption = 'none';
          } else if (value === 'trojan') {
            updated.tls = 'tls';
          }
        }
        return updated;
      })
    );
  };

  const addNode = () => {
    const newNode = createEmptyNode();
    setNodes((prev) => [...prev, newNode]);
    setExpandedNodes((prev) => new Set([...prev, newNode.id]));
  };

  const removeNode = (id: string) => {
    if (nodes.length <= 1) return;
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const payload = {
        nodes: nodes.map((n) => ({
          protocol: n.protocol,
          address: n.address,
          port: parseInt(n.port, 10) || 0,
          account: n.account,
          password: n.password,
          nodeName: n.nodeName || `Node-${n.id}`,
          encryption: n.encryption,
          network: n.network,
          tls: n.tls,
          sni: n.sni,
          path: n.path,
          host: n.host,
          alterId: parseInt(n.alterId, 10) || 0,
        })),
      };

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
          {/* Left: Node Input Form */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Server className="w-5 h-5 text-cyan-400" />
                节点配置
              </h2>
              <button
                onClick={addNode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加节点
              </button>
            </div>

            {nodes.map((node, index) => {
              const isExpanded = expandedNodes.has(node.id);
              return (
                <div
                  key={node.id}
                  className="rounded-xl border border-cyan-500/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-cyan-500/20"
                >
                  {/* Node Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
                    onClick={() => toggleExpand(node.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-300">
                        {node.nodeName || `节点 ${index + 1}`}
                      </span>
                      <span className="text-xs text-slate-500">
                        {protocolLabels[node.protocol]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {nodes.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNode(node.id);
                          }}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </div>

                  {/* Node Form */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-cyan-500/5">
                      {/* Protocol + Node Name */}
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">
                            协议类型
                          </label>
                          <select
                            value={node.protocol}
                            onChange={(e) => updateNode(node.id, 'protocol', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                          >
                            {Object.entries(protocolLabels).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">
                            节点名称
                          </label>
                          <input
                            type="text"
                            value={node.nodeName}
                            onChange={(e) => updateNode(node.id, 'nodeName', e.target.value)}
                            placeholder="如：东京-01"
                            className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Address + Port */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            服务器地址
                          </label>
                          <input
                            type="text"
                            value={node.address}
                            onChange={(e) => updateNode(node.id, 'address', e.target.value)}
                            placeholder="IP 或域名"
                            className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            端口
                          </label>
                          <input
                            type="number"
                            value={node.port}
                            onChange={(e) => updateNode(node.id, 'port', e.target.value)}
                            placeholder="443"
                            className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Account + Password */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {node.protocol === 'ss' ? '加密方式' : node.protocol === 'vmess' || node.protocol === 'vless' ? 'UUID' : '账号'}
                          </label>
                          <input
                            type="text"
                            value={node.account}
                            onChange={(e) => updateNode(node.id, 'account', e.target.value)}
                            placeholder={
                              node.protocol === 'ss'
                                ? 'aes-256-gcm'
                                : node.protocol === 'vmess' || node.protocol === 'vless'
                                  ? 'UUID'
                                  : '账号'
                            }
                            className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                            <KeyRound className="w-3 h-3" />
                            密码
                          </label>
                          <input
                            type="text"
                            value={node.password}
                            onChange={(e) => updateNode(node.id, 'password', e.target.value)}
                            placeholder="密码"
                            className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Advanced Fields */}
                      <details className="group">
                        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 transition-colors list-none flex items-center gap-1">
                          <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                          高级设置
                        </summary>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1.5">
                              加密方式
                            </label>
                            <input
                              type="text"
                              value={node.encryption}
                              onChange={(e) => updateNode(node.id, 'encryption', e.target.value)}
                              placeholder="auto"
                              className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1.5">
                              传输协议
                            </label>
                            <select
                              value={node.network}
                              onChange={(e) => updateNode(node.id, 'network', e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                            >
                              <option value="tcp">TCP</option>
                              <option value="ws">WebSocket</option>
                              <option value="grpc">gRPC</option>
                              <option value="h2">HTTP/2</option>
                              <option value="quic">QUIC</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1.5">
                              TLS
                            </label>
                            <select
                              value={node.tls}
                              onChange={(e) => updateNode(node.id, 'tls', e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                            >
                              <option value="">关闭</option>
                              <option value="tls">TLS</option>
                              <option value="reality">Reality</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1.5">
                              SNI
                            </label>
                            <input
                              type="text"
                              value={node.sni}
                              onChange={(e) => updateNode(node.id, 'sni', e.target.value)}
                              placeholder="域名"
                              className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1.5">
                              Path
                            </label>
                            <input
                              type="text"
                              value={node.path}
                              onChange={(e) => updateNode(node.id, 'path', e.target.value)}
                              placeholder="/path"
                              className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1.5">
                              Host
                            </label>
                            <input
                              type="text"
                              value={node.host}
                              onChange={(e) => updateNode(node.id, 'host', e.target.value)}
                              placeholder="域名"
                              className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                            />
                          </div>
                          {node.protocol === 'vmess' && (
                            <div>
                              <label className="block text-xs text-slate-400 mb-1.5">
                                Alter ID
                              </label>
                              <input
                                type="number"
                                value={node.alterId}
                                onChange={(e) => updateNode(node.id, 'alterId', e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                              />
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/25 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  生成订阅文件
                </>
              )}
            </button>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            {!result ? (
              <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-900/30 backdrop-blur-sm p-12 text-center">
                <QrCode className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">
                  填写节点信息后点击生成，结果将在此展示
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
                      <div
                        key={i}
                        className="text-xs font-mono text-slate-400 bg-slate-800/50 p-2.5 rounded-lg break-all"
                      >
                        {uri}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Base64 Result */}
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
                    <p className="text-xs text-slate-500 mt-2">
                      可在客户端中使用此链接作为订阅地址
                    </p>
                  </div>
                </div>

                {/* QR Code */}
                <div className="rounded-xl border border-cyan-500/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-cyan-500/10">
                    <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-cyan-400" />
                      二维码
                    </h3>
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
                    <p className="text-xs text-slate-500 text-center">
                      扫描二维码获取订阅文件地址
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-slate-600">
          VPN 节点配置工具 - 仅用于合法用途
        </footer>
      </div>
    </div>
  );
}
