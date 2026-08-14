import React from 'react';
import { Terminal, Code, Key, ChevronRight, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function ApiDocumentation() {
  const [copiedId, setCopiedId] = useState(null);

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
    { name: "upload_media", desc: "Mengunggah gambar/video Base64 dan mendapatkan URL." },
    { name: "get_templates", desc: "Mengambil daftar template caption." },
    { name: "generate_caption", desc: "Men-generate caption menggunakan AI internal." },
    { name: "get_stats", desc: "Melihat statistik dashboard." }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
          <Terminal className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">AI Agent API</h1>
          <p className="text-sm text-slate-400">Dokumentasi endpoint terpadu untuk integrasi AI Agent.</p>
        </div>
      </div>

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

            <p className="text-sm text-slate-400 mb-2">Endpoint ini menggunakan pola <strong>Tool Calling</strong>, di mana agent mengirimkan <code>action</code> spesifik di dalam body request.</p>
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

          {/* Action List */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-200">Daftar Action yang Didukung</h2>
            </div>
            <div className="divide-y divide-slate-800/50">
              {actions.map((act, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-800/30 transition-colors flex items-start gap-3">
                  <ChevronRight className="w-5 h-5 text-indigo-500/50 shrink-0 mt-0.5" />
                  <div>
                    <code className="text-sm font-semibold text-indigo-300 block mb-1">{act.name}</code>
                    <p className="text-sm text-slate-400">{act.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column - Auth & Tips */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-slate-900 border border-indigo-500/20 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2">
              <Key className="w-5 h-5" /> Autentikasi
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Semua request ke API Agent wajib menyertakan <strong>Bearer Token</strong> di header Authorization. Token ini adalah JWT yang didapatkan saat login.
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
    </div>
  );
}
