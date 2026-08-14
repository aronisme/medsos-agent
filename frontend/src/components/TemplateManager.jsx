import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { FileText, Plus, Copy, Check, Trash2, X } from 'lucide-react';

export default function TemplateManager({ onApplyTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/templates');
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error('Gagal mengambil template', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleAddTemplate = async (e) => {
    e.preventDefault();
    if (!title || !content) return;
    setSubmitting(true);
    try {
      await api.post('/templates', { title, content });
      setShowAddModal(false);
      setTitle('');
      setContent('');
      fetchTemplates();
    } catch (err) {
      alert('Gagal membuat template.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin hapus template ini?')) return;
    try {
      await api.delete(`/templates/${id}`);
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err) {
      alert('Gagal menghapus template.');
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>Template Caption & Konten</span>
          </h2>
          <p className="text-xs text-slate-400">Simpan template postingan favorit untuk penggunaan berulang</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl gradient-btn text-xs font-bold flex items-center gap-2 shadow-lg self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Template Baru</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Memuat template...</div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl space-y-3">
          <FileText className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">Belum ada template terdaftar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between"
            >
              <div>
                <h3 className="font-bold text-base text-white mb-2">{tpl.title}</h3>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {tpl.content}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => handleCopy(tpl.id, tpl.content)}
                  className="p-1.5 text-xs text-slate-400 hover:text-white rounded-lg flex items-center gap-1 hover:bg-slate-800"
                >
                  {copiedId === tpl.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === tpl.id ? 'Tersalin' : 'Salin'}</span>
                </button>

                <div className="flex items-center gap-2">
                  {onApplyTemplate && (
                    <button
                      onClick={() => onApplyTemplate(tpl.content, tpl.title)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"
                    >
                      Gunakan
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(tpl.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Tambah Template Caption</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Judul Template *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Template Promo Flash Sale"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Isi Template *</label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tulis format caption template di sini..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl gradient-btn font-bold text-xs shadow-lg"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Template'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
