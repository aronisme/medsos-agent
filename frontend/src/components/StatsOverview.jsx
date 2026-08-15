import React, { useEffect, useState } from 'react';
import api from '../api/client';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Share2,
  PenTool,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export default function StatsOverview({ setActiveTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Gagal mengambil statistik', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const summary = stats?.summary || {};
  const totalPosts = (summary.draft || 0) + (summary.scheduled || 0) + (summary.posted || 0) + (summary.failed || 0);

  const cards = [
    {
      title: 'Total Postingan',
      value: totalPosts,
      icon: Calendar,
      color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
    },
    {
      title: 'Terjadwal',
      value: summary.scheduled || 0,
      icon: Clock,
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
    },
    {
      title: 'Berhasil Terpublish',
      value: summary.posted || 0,
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
    },
    {
      title: 'Gagal Publish',
      value: summary.failed || 0,
      icon: AlertTriangle,
      color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-400',
    },
    {
      title: 'Akun Sosmed Aktif',
      value: stats?.activeAccounts || 'N/A',
      icon: Share2,
      color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/20 p-6 lg:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-semibold border border-indigo-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FB, IG & Threads Automation Dashboard</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Kelola & Jadwalkan Konten Media Sosial Anda
          </h2>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Otomatiskan postingan ke Halaman Facebook, Akun Instagram Bisnis, dan Meta Threads. Lengkap dengan dukungan Carousel, Reply Thread, dan bantuan Mistral AI.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              onClick={() => setActiveTab('composer')}
              className="px-5 py-2.5 rounded-xl gradient-btn text-sm font-semibold flex items-center gap-2 shadow-lg"
            >
              <PenTool className="w-4 h-4" />
              <span>Buat Postingan Baru</span>
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className="px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 text-sm font-semibold flex items-center gap-2 transition-all"
            >
              <Share2 className="w-4 h-4 text-purple-400" />
              <span>Hubungkan Akun</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Ringkasan Performa</span>
          </h3>
          <button
            onClick={fetchStats}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Muat Ulang Stats"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className={`p-5 rounded-2xl bg-gradient-to-br ${card.color} border bg-slate-900/40 backdrop-blur-md transition-all hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{card.title}</span>
                  <div className="p-2 rounded-xl bg-slate-950/60">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    {loading ? '...' : card.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
