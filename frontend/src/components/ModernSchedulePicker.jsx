import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Zap, Sun, Sunrise, Moon, Sparkles, Check, ChevronRight } from 'lucide-react';

export default function ModernSchedulePicker({ value, onChange }) {
  // Helper to format Date object into local YYYY-MM-DDTHH:mm string
  const toLocalISOString = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper to parse ISO or fallback to 1 hour from now
  const parseCurrent = () => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const defaultDate = new Date();
    defaultDate.setHours(defaultDate.getHours() + 1);
    defaultDate.setMinutes(0, 0, 0);
    return defaultDate;
  };

  const currentDate = parseCurrent();
  const [selectedDate, setSelectedDate] = useState(currentDate);

  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
      }
    }
  }, [value]);

  const updateDate = (newDate) => {
    setSelectedDate(newDate);
    onChange(toLocalISOString(newDate));
  };

  // Presets
  const applyPreset = (type) => {
    const now = new Date();
    const target = new Date();

    switch (type) {
      case '15m':
        target.setMinutes(now.getMinutes() + 15);
        break;
      case '1h':
        target.setHours(now.getHours() + 1);
        break;
      case '3h':
        target.setHours(now.getHours() + 3);
        break;
      case 'tomorrow_morning':
        target.setDate(now.getDate() + 1);
        target.setHours(9, 0, 0, 0);
        break;
      case 'tomorrow_afternoon':
        target.setDate(now.getDate() + 1);
        target.setHours(13, 0, 0, 0);
        break;
      case 'tomorrow_evening':
        target.setDate(now.getDate() + 1);
        target.setHours(19, 30, 0, 0);
        break;
      default:
        break;
    }
    updateDate(target);
  };

  // Day picker helper
  const setDayOffset = (days) => {
    const next = new Date(selectedDate);
    const base = new Date();
    base.setDate(base.getDate() + days);
    next.setFullYear(base.getFullYear(), base.getMonth(), base.getDate());
    updateDate(next);
  };

  // Time setters
  const setTime = (hours, minutes) => {
    const next = new Date(selectedDate);
    next.setHours(hours);
    next.setMinutes(minutes);
    updateDate(next);
  };

  // Format Indonesian preview
  const formatIndonesianDateTime = (d) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const pad = (n) => String(n).padStart(2, '0');
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} pukul ${pad(d.getHours())}:${pad(d.getMinutes())} WIB`;
  };

  // Relative time helper
  const getRelativeTime = (d) => {
    const diffMs = d.getTime() - Date.now();
    if (diffMs <= 0) return 'waktu sudah lewat';
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 60) return `dalam ${diffMin} menit lagi`;
    const diffHours = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (diffHours < 24) return `dalam ${diffHours} jam ${remMin > 0 ? remMin + ' mnt' : ''} lagi`;
    const diffDays = Math.floor(diffHours / 24);
    return `dalam ${diffDays} hari lagi`;
  };

  const isToday = (d) => {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const isTomorrow = (d) => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return d.getDate() === tom.getDate() && d.getMonth() === tom.getMonth() && d.getFullYear() === tom.getFullYear();
  };

  const pad = (n) => String(n).padStart(2, '0');
  const currentHour = selectedDate.getHours();
  const currentMinute = selectedDate.getMinutes();

  return (
    <div className="space-y-3.5 p-4 bg-slate-900/90 border border-amber-500/30 rounded-2xl shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Decorative ambient glow */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Atur Jadwal Otomatis</h4>
            <p className="text-[11px] text-slate-400">Pilih waktu publish dengan praktis</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-400">
          Auto Trigger GAS
        </span>
      </div>

      {/* Quick 1-Click Presets */}
      <div>
        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Pilihan Cepat (1-Klik)</span>
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset('15m')}
            className="py-1.5 px-2 bg-slate-950/80 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 rounded-xl text-[11px] font-semibold text-slate-300 hover:text-amber-300 transition-all text-center"
          >
            +15 Mnt
          </button>
          <button
            type="button"
            onClick={() => applyPreset('1h')}
            className="py-1.5 px-2 bg-slate-950/80 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 rounded-xl text-[11px] font-semibold text-slate-300 hover:text-amber-300 transition-all text-center"
          >
            +1 Jam
          </button>
          <button
            type="button"
            onClick={() => applyPreset('3h')}
            className="py-1.5 px-2 bg-slate-950/80 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 rounded-xl text-[11px] font-semibold text-slate-300 hover:text-amber-300 transition-all text-center"
          >
            +3 Jam
          </button>
          <button
            type="button"
            onClick={() => applyPreset('tomorrow_morning')}
            className="py-1.5 px-2 bg-slate-950/80 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 rounded-xl text-[11px] font-semibold text-slate-300 hover:text-amber-300 transition-all text-center flex items-center justify-center gap-1"
          >
            <Sunrise className="w-3 h-3 text-amber-400" />
            <span>Bsk 09:00</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('tomorrow_afternoon')}
            className="py-1.5 px-2 bg-slate-950/80 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 rounded-xl text-[11px] font-semibold text-slate-300 hover:text-amber-300 transition-all text-center flex items-center justify-center gap-1"
          >
            <Sun className="w-3 h-3 text-yellow-400" />
            <span>Bsk 13:00</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('tomorrow_evening')}
            className="py-1.5 px-2 bg-slate-950/80 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 rounded-xl text-[11px] font-semibold text-slate-300 hover:text-amber-300 transition-all text-center flex items-center justify-center gap-1"
          >
            <Moon className="w-3 h-3 text-indigo-400" />
            <span>Bsk 19:30</span>
          </button>
        </div>
      </div>

      {/* Date & Time Custom Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Day Selector */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Pilih Hari
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setDayOffset(0)}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                isToday(selectedDate)
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setDayOffset(1)}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                isTomorrow(selectedDate)
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Besok
            </button>
            <div className="relative flex-1">
              <input
                type="date"
                value={`${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  const next = new Date(selectedDate);
                  next.setFullYear(y, m - 1, d);
                  updateDate(next);
                }}
                className="w-full h-full py-1.5 px-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl text-[11px] font-semibold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Time Selector */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Pilih Jam & Menit
          </label>
          <div className="flex items-center gap-1.5">
            {/* Hour select */}
            <select
              value={currentHour}
              onChange={(e) => setTime(Number(e.target.value), currentMinute)}
              className="flex-1 py-2 px-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={i} className="bg-slate-900 text-white">
                  Jam {pad(i)}:00
                </option>
              ))}
            </select>

            <span className="text-slate-500 font-bold">:</span>

            {/* Minute select */}
            <select
              value={currentMinute}
              onChange={(e) => setTime(currentHour, Number(e.target.value))}
              className="flex-1 py-2 px-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {Array.from({ length: 60 }).map((_, i) => (
                <option key={i} value={i} className="bg-slate-900 text-white">
                  {pad(i)} mnt
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Confirmation & Human Readable Preview Banner */}
      <div className="p-3 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <Check className="w-3 h-3" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-200 truncate">
              {formatIndonesianDateTime(selectedDate)}
            </p>
            <p className="text-[11px] text-amber-400/80 font-medium">
              Eksekusi {getRelativeTime(selectedDate)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
