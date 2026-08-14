import React, { useState } from 'react';
import api from '../api/client';
import { Sparkles, X, Wand2, Copy, Check, Hash } from 'lucide-react';

export default function AiGeneratorModal({ isOpen, onClose, onApplyCaption }) {
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('promosi');
  const [platform, setPlatform] = useState('keduanya');
  const [generatedResult, setGeneratedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setGeneratedResult(null);

    try {
      const res = await api.post('/ai/generate', {
        prompt,
        tone,
        platform,
      });
      setGeneratedResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menghasilkan caption dengan AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedResult?.content) return;
    navigator.clipboard.writeText(generatedResult.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (generatedResult?.content) {
      onApplyCaption(generatedResult.content, generatedResult.title || '');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-left">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Mistral AI Caption Assistant</h3>
              <p className="text-xs text-slate-400">Buat caption & hashtag otomatis sesuai gaya postingan Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Topik / Deskripsi Singkat Konten *
            </label>
            <textarea
              required
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Contoh: Diskon 50% untuk produk skincare lokal baru varian Serum Vitamin C selama akhir pekan..."
              className="w-full p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nada / Tone Bahasa
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="promosi">🔥 Promosi & Penjualan</option>
                <option value="santai">😊 Santai & Akrab</option>
                <option value="profesional">💼 Profesional & Resmi</option>
                <option value="informatif">💡 Informatif & Edukatif</option>
                <option value="lucu">😂 Lucu & Menghibur</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="keduanya">Facebook & Instagram</option>
                <option value="facebook">Facebook Page</option>
                <option value="instagram">Instagram Feed</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl gradient-btn flex items-center justify-center gap-2 text-sm font-semibold shadow-lg"
          >
            {loading ? (
              <>
                <Wand2 className="w-4 h-4 animate-spin" />
                <span>Mistral AI sedang membuat caption...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Caption Sekarang</span>
              </>
            )}
          </button>
        </form>

        {/* Result Area */}
        {generatedResult && (
          <div className="mt-5 p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Hasil Generasi Mistral AI
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 rounded-lg flex items-center gap-1 border border-slate-800"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {generatedResult.title && (
              <p className="text-xs font-bold text-slate-200">Judul: {generatedResult.title}</p>
            )}

            <div className="max-h-48 overflow-y-auto pr-1">
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                {generatedResult.content}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all"
              >
                Gunakan Caption Ini di Editor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
