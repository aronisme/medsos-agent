import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Sparkles,
  TrendingUp,
  Award,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Layers,
  Lightbulb,
  FileText,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import api from '../api/client';

export default function TemplateExperimentLab() {
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState([]);
  const [insights, setInsights] = useState([]);
  const [evaluatingId, setEvaluatingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expRes, insRes] = await Promise.all([
        api.get('/agent-orchestrator/experiments'),
        api.get('/agent-orchestrator/insights'),
      ]);

      if (expRes.data.success) setExperiments(expRes.data.experiments || []);
      if (insRes.data.success) setInsights(insRes.data.insights || []);
    } catch (err) {
      console.error('Error fetching lab data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async (expId) => {
    try {
      setEvaluatingId(expId);
      const res = await api.post(`/agent-orchestrator/experiments/${expId}/evaluate`);
      if (res.data.success) {
        fetchData();
      }
    } catch (err) {
      console.error('Error evaluating experiment:', err);
    } finally {
      setEvaluatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Scientific A/B Testing & Knowledge Lab</span>
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">
            Laboratorium Eksperimen Konten & Template
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Evaluasi A/B testing multi-varian secara empiris, ukuran sampel, dan wawasan sintesis AI.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Synthesized Knowledge Insights Feed */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span>Wawasan Strategis Terverifikasi (Learning Layer)</span>
        </div>

        {insights.length === 0 ? (
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500">
            Learning Layer sedang mengumpulkan data sampel postingan untuk menghasilkan wawasan strategi baru.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-slate-900/40 to-slate-900 border border-indigo-500/20 relative overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase">
                    {ins.platform || 'Cross-Platform'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    ins.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    Confidence: {ins.confidence || 'Medium'}
                  </span>
                </div>
                <p className="text-xs text-slate-200 font-medium leading-relaxed">{ins.finding}</p>
                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="text-indigo-400 font-semibold">{ins.recommended_action}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* A/B Experiments Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <FlaskConical className="w-4 h-4 text-purple-400" />
            <span>Daftar Eksperimen A/B Testing ({experiments.length})</span>
          </div>
        </div>

        {experiments.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-3xl">
            Belum ada eksperimen A/B aktif. Eksperimen akan dibuat otomatis saat siklus otonom berjalan.
          </div>
        ) : (
          <div className="space-y-4">
            {experiments.map((exp) => {
              const summary = exp.metrics_summary || {};
              const isCompleted = exp.status === 'completed';

              return (
                <div
                  key={exp.id}
                  className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-purple-400">{exp.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
                        }`}>
                          {exp.status || 'Running'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 mt-1">
                        Hipotesis: {exp.hypothesis}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleEvaluate(exp.id)}
                      disabled={evaluatingId === exp.id}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto border border-slate-700 transition-colors disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      <span>{evaluatingId === exp.id ? 'Mengevaluasi...' : 'Evaluasi Metrik'}</span>
                    </button>
                  </div>

                  {/* Variants Comparison Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(exp.variants || []).map((v) => {
                      const isWinner = summary.winner_variant === v.variant_id;
                      return (
                        <div
                          key={v.variant_id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isWinner
                              ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                              : 'bg-slate-950/60 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
                              <span>Varian {v.variant_id}</span>
                              {isWinner && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                                  WINNER 🏆
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-slate-400 uppercase font-semibold">
                              Tipe: {v.media_type || 'image'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-1 mb-3">
                            Template: {v.template_name || v.template_id || 'PAS Default'}
                          </p>

                          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-center">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Views</span>
                              <span className="text-xs font-bold text-slate-200">{v.sample_views || 0}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Clicks</span>
                              <span className="text-xs font-bold text-emerald-400">{v.clicks || 0}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">CTR</span>
                              <span className="text-xs font-bold text-cyan-300">
                                {((v.ctr || 0) * 100).toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary & Confidence Bar */}
                  {summary.relative_lift && (
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Relative Lift:</span>
                        <span className="text-emerald-400 font-extrabold">{summary.relative_lift}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Confidence Level:</span>
                        <span className={`font-bold uppercase ${
                          summary.confidence_level === 'high' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {summary.confidence_level || 'preliminary'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>Total Sampel: {summary.sample_size_total || 0} tayangan</span>
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
