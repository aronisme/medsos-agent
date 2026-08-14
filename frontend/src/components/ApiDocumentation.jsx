import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Code,
  Key,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertCircle,
  FileText
} from 'lucide-react';
import api from '../api/client';

export default function ApiDocumentation() {
  const [copiedId, setCopiedId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get('/agent/logs?limit=50');
      if (res.data?.logs) {
        setLogs(res.data.logs);
      }
    } catch (err) {
      console.error('Gagal mengambil agent logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const endpoint = "POST /api/agent/execute";
  
  const payloadExample = `{
  "action": "create_post",
  "params": {
    "title": "Promo Akhir Tahun",
    "content": "Dapatkan diskon 50% untuk semua item!",
    "media": [{"url": "https://example.com/image.jpg", "type": "image"}],
    "targets": ["account_id_1", "account_id_2"],
    "scheduled_at": "2026-12-31T10:00:00Z"
  }
}`;

  const actions = [
    { name: "get_accounts", desc: "Mengambil daftar akun sosial media yang terhubung." },
    { name: "create_post", desc: "Membuat postingan baru (draft/jadwal)." },
    { name: "update_post", desc: "Mengedit postingan yang belum terpublish." },
    { name: "publish_post", desc: "Mempublikasikan postingan secara langsung." },
    { name: "get_posts", desc: "Melihat daftar postingan & history." },
    { name: "delete_post", desc: "Menghapus postingan." },
    { name: "upload_media", desc: "Mengunggah gambar/video Base64 dan mendapatkan URL publik." },
    { name: "get_templates", desc: "Mengambil daftar template caption." },
    { name: "generate_caption", desc: "Men-generate caption menggunakan AI internal." },
    { name: "get_stats", desc: "Melihat statistik dashboard." },
    { name: "get_agent_logs", desc: "Melihat riwayat log panggilan API oleh AI Agent." }
  ];

  const filteredLogs = logs.filter(log => {
    if (logFilter === 'success') return log.status === 'success';
    if (logFilter === 'failed') return log.status === 'failed';
    return true;
  });

  const getActionBadgeColor = (act) => {
    switch (act) {
      case 'create_post': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'publish_post': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'upload_media': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'get_stats': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'get_accounts': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      default: return 'bg-slate-700/40 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <Terminal className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">AI Agent API & Activity Logs</h1>
            <p className="text-sm text-slate-400">Pusat dokumentasi dan riwayat audit pemanggilan API oleh AI Agent.</p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loadingLogs}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Grid: Docs & Auth Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Main Docs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Endpoint Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-400" /> Endpoint Utama
            </h2>
            
            <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80 mb-4">
              <span className="px-2.5 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded-md">POST</span>
              <code className="text-sm text-slate-300 flex-1">{endpoint}</code>
              <button 
                onClick={() => copyToClipboard(endpoint, 'endpoint')}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-slate-300"
              >
                {copiedId === 'endpoint' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-sm text-slate-400">Endpoint ini menggunakan pola <strong>Tool Calling</strong>, di mana agent mengirimkan <code>action</code> spesifik di dalam body request.</p>
          </div>

          {/* Payload Example */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Contoh Request Body</h2>
            <div className="relative">
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 overflow-x-auto text-sm text-indigo-300 font-mono">
                {payloadExample}
              </pre>
              <button 
                onClick={() => copyToClipboard(payloadExample, 'payload')}
                className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-slate-300 border border-slate-700/50"
              >
                {copiedId === 'payload' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column - Auth & Media */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-slate-900 border border-indigo-500/20 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2">
              <Key className="w-5 h-5" /> Autentikasi
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Semua request ke API Agent wajib menyertakan <strong>Bearer Token</strong> di header Authorization.
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 break-all text-xs text-slate-500 font-mono">
              Authorization: Bearer &lt;YOUR_JWT_TOKEN&gt;
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Upload Media Base64</h3>
            <p className="text-sm text-slate-400 mb-3">
              Gunakan action <code>upload_media</code> untuk mengirimkan string Base64 gambar. Server akan menyimpan file dan mengembalikan URL publik.
            </p>
            <div className="text-xs bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-emerald-400 font-mono">
              "params": &#123;<br/>
              &nbsp;&nbsp;"file_base64": "iVBORw0KGgo...",<br/>
              &nbsp;&nbsp;"file_name": "ai_gen.jpg",<br/>
              &nbsp;&nbsp;"mime_type": "image/jpeg"<br/>
              &#125;
            </div>
          </div>
        </div>
      </div>

      {/* Action Reference Accordion/List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-200">Daftar Action yang Didukung</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/50">
          <div className="divide-y divide-slate-800/50">
            {actions.slice(0, Math.ceil(actions.length / 2)).map((act, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-800/30 transition-colors flex items-start gap-3">
                <ChevronRight className="w-5 h-5 text-indigo-500/50 shrink-0 mt-0.5" />
                <div>
                  <code className="text-xs font-bold text-indigo-300 block mb-0.5">{act.name}</code>
                  <p className="text-xs text-slate-400">{act.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="divide-y divide-slate-800/50">
            {actions.slice(Math.ceil(actions.length / 2)).map((act, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-800/30 transition-colors flex items-start gap-3">
                <ChevronRight className="w-5 h-5 text-indigo-500/50 shrink-0 mt-0.5" />
                <div>
                  <code className="text-xs font-bold text-indigo-300 block mb-0.5">{act.name}</code>
                  <p className="text-xs text-slate-400">{act.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== SECTION: REAL-TIME AGENT ACTIVITY LOGS ==================== */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              <span>Riwayat Log Panggilan API Agent</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">Audit setiap request, status berhasil/gagal, parameter, dan hasil postingan dari Agent AI.</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setLogFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                logFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua ({logs.length})
            </button>
            <button
              onClick={() => setLogFilter('success')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                logFilter === 'success' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              Berhasil ({logs.filter(l => l.status === 'success').length})
            </button>
            <button
              onClick={() => setLogFilter('failed')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                logFilter === 'failed' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Gagal ({logs.filter(l => l.status === 'failed').length})
            </button>
          </div>
        </div>

        {/* Logs Table / List */}
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30 text-indigo-400" />
            <p className="text-sm font-medium">Belum ada catatan log panggilan API dari Agent AI.</p>
            <p className="text-xs text-slate-600 mt-1">Setiap kali Agent AI memanggil endpoint /api/agent/execute, riwayatnya akan otomatis muncul di sini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const isSuccess = log.status === 'success';

              return (
                <div key={log.id} className="transition-colors hover:bg-slate-800/20">
                  <div 
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      {isSuccess ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>

                          <span className="text-xs text-slate-300 font-medium">
                            {log.result?.title ? `"${log.result.title}"` : log.params?.title ? `"${log.params.title}"` : log.error || 'Aksi dieksekusi'}
                          </span>
                        </div>

                        {log.params?.content && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                            {log.params.content}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0 self-end md:self-auto">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}</span>
                      </div>
                      
                      {log.ip && (
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[10px] text-slate-400">
                          {log.ip}
                        </span>
                      )}

                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 bg-slate-950/60 border-t border-slate-800/60 space-y-4 text-xs animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Params */}
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Send className="w-3 h-3 text-indigo-400" /> Request Parameters (Input)
                          </div>
                          <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 overflow-x-auto text-indigo-300 font-mono max-h-48 text-[11px]">
                            {JSON.stringify(log.params || {}, null, 2)}
                          </pre>
                        </div>

                        {/* Result / Error */}
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            {isSuccess ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                            )}
                            {isSuccess ? 'Execution Result (Output)' : 'Error Message'}
                          </div>
                          <pre className={`bg-slate-950 p-3 rounded-xl border border-slate-800/80 overflow-x-auto font-mono max-h-48 text-[11px] ${
                            isSuccess ? 'text-emerald-300' : 'text-rose-300'
                          }`}>
                            {JSON.stringify(log.result || { error: log.error }, null, 2)}
                          </pre>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-900">
                        <span>User Agent: {log.user_agent || 'Unknown'}</span>
                        <span>Log ID: {log.id}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
