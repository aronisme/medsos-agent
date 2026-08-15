import React, { useState } from 'react';
import { Facebook, Instagram, Heart, MessageCircle, Share2, ThumbsUp, MoreHorizontal, Globe, AtSign, Repeat, CheckCircle2 } from 'lucide-react';

export default function PostPreview({ content = '', title = '', mediaUrl = '', mediaType = 'image', selectedAccounts = [], replyToId = '', quotePostId = '' }) {
  const [platformTab, setPlatformTab] = useState('facebook');

  // Get demo account names or fallback
  const pageName = selectedAccounts.length > 0
    ? (selectedAccounts[0]?.page_name || 'Akun Saya')
    : 'Akun Saya';

  const charCount = content ? content.length : 0;
  const isThreadsExceeded = charCount > 500;

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>Live Preview Tampilan</span>
        </h3>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setPlatformTab('facebook')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              platformTab === 'facebook'
                ? 'bg-fb-blue text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Facebook className="w-3.5 h-3.5" />
            <span>FB</span>
          </button>
          <button
            type="button"
            onClick={() => setPlatformTab('instagram')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              platformTab === 'instagram'
                ? 'bg-gradient-to-r from-ig-purple via-ig-pink to-ig-orange text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Instagram className="w-3.5 h-3.5" />
            <span>IG</span>
          </button>
          <button
            type="button"
            onClick={() => setPlatformTab('threads')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              platformTab === 'threads'
                ? 'bg-black text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AtSign className="w-3.5 h-3.5" />
            <span>Threads</span>
          </button>
        </div>
      </div>

      {platformTab === 'facebook' ? (
        /* Facebook Card Preview */
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl text-slate-100 max-w-sm mx-auto text-left">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-fb-blue flex items-center justify-center font-bold text-white text-xs">
                {pageName.charAt(0)}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1">
                  {pageName}
                  <span className="w-3 h-3 bg-blue-500 rounded-full inline-flex items-center justify-center text-[8px] text-white">✓</span>
                </h4>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>Baru saja</span> • <Globe className="w-2.5 h-2.5" />
                </p>
              </div>
            </div>
            <MoreHorizontal className="w-4 h-4 text-slate-500" />
          </div>

          {/* Title & Body */}
          {title && <p className="text-xs font-bold text-slate-200 mb-1">{title}</p>}
          <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mb-3">
            {content || 'Tulis isi postingan Anda di sebelah kiri untuk melihat preview live...'}
          </p>

          {/* Media */}
          {mediaUrl && (
            <div className="rounded-xl overflow-hidden mb-3 border border-slate-800 bg-slate-900 max-h-64 flex items-center justify-center">
              {mediaType === 'video' ? (
                <video src={mediaUrl} controls className="w-full max-h-64 object-contain" />
              ) : (
                <img src={mediaUrl} alt="Preview" className="w-full max-h-64 object-cover" />
              )}
            </div>
          )}

          {/* FB Actions */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-400 text-xs font-semibold">
            <button className="flex items-center gap-1.5 hover:text-fb-blue py-1 px-2 rounded-lg hover:bg-slate-900 transition-colors">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Suka</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-slate-200 py-1 px-2 rounded-lg hover:bg-slate-900 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Komentar</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-slate-200 py-1 px-2 rounded-lg hover:bg-slate-900 transition-colors">
              <Share2 className="w-3.5 h-3.5" />
              <span>Bagikan</span>
            </button>
          </div>
        </div>
      ) : platformTab === 'instagram' ? (
        /* Instagram Card Preview */
        <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl text-slate-100 max-w-sm mx-auto overflow-hidden text-left">
          {/* Header */}
          <div className="p-3 flex items-center justify-between border-b border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full p-0.5 bg-gradient-to-tr from-ig-orange via-ig-pink to-ig-purple">
                <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                  {pageName.charAt(0)}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-tight">
                  {pageName.toLowerCase().replace(/\s+/g, '_')}
                </h4>
                <p className="text-[10px] text-slate-400">Instagram Feed</p>
              </div>
            </div>
            <MoreHorizontal className="w-4 h-4 text-slate-500" />
          </div>

          {/* Media */}
          <div className="w-full aspect-square bg-slate-900 flex items-center justify-center overflow-hidden border-b border-slate-800/60">
            {mediaUrl ? (
              mediaType === 'video' ? (
                <video src={mediaUrl} controls className="w-full h-full object-cover" />
              ) : (
                <img src={mediaUrl} alt="IG Preview" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="text-center p-6 text-slate-500 text-xs">
                <Instagram className="w-8 h-8 mx-auto mb-2 opacity-40 text-ig-pink" />
                <span>Media/Gambar wajib untuk postingan Instagram</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 text-slate-200">
                <Heart className="w-4 h-4 hover:text-ig-pink cursor-pointer transition-colors" />
                <MessageCircle className="w-4 h-4 hover:text-slate-400 cursor-pointer transition-colors" />
                <Share2 className="w-4 h-4 hover:text-slate-400 cursor-pointer transition-colors" />
              </div>
            </div>

            {/* Caption */}
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-white mr-1.5">
                {pageName.toLowerCase().replace(/\s+/g, '_')}
              </span>
              <span className="whitespace-pre-wrap">
                {content || 'Caption postingan Instagram...'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Threads Card Preview */
        <div className="bg-black border border-slate-800 rounded-2xl p-4 shadow-2xl text-slate-100 max-w-sm mx-auto text-left relative">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-white text-xs relative">
                {pageName.charAt(0)}
                <div className="absolute -bottom-1 -right-1 bg-black border border-slate-700 rounded-full p-0.5">
                  <AtSign className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1">
                  {pageName.toLowerCase().replace(/\s+/g, '_')}
                  <CheckCircle2 className="w-3 h-3 text-sky-400 fill-sky-400/20" />
                </h4>
                <p className="text-[10px] text-slate-500">Threads Post</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                isThreadsExceeded
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {charCount}/500
              </span>
              <MoreHorizontal className="w-4 h-4 text-slate-500" />
            </div>
          </div>

          {/* Reply / Quote indicators */}
          {replyToId && (
            <div className="mb-2 px-2.5 py-1 bg-slate-900/90 border border-indigo-500/30 rounded-lg text-[10px] text-indigo-300 flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3 text-indigo-400" />
              <span>Membalas Threads Post #{replyToId}</span>
            </div>
          )}

          {quotePostId && (
            <div className="mb-2 px-2.5 py-1 bg-slate-900/90 border border-amber-500/30 rounded-lg text-[10px] text-amber-300 flex items-center gap-1.5">
              <Repeat className="w-3 h-3 text-amber-400" />
              <span>Mengutip Threads Post #{quotePostId}</span>
            </div>
          )}

          {/* Title (If internal) */}
          {title && <p className="text-xs font-bold text-slate-300 mb-1">[{title}]</p>}

          {/* Content Body */}
          <p className={`text-xs whitespace-pre-wrap leading-relaxed mb-3 ${
            isThreadsExceeded ? 'text-rose-300' : 'text-slate-200'
          }`}>
            {content || 'Tulis isi postingan Threads Anda...'}
          </p>

          {isThreadsExceeded && (
            <p className="text-[10px] text-rose-400 mb-2 font-medium">
              ⚠️ Teks melebihi batas 500 karakter Meta Threads API.
            </p>
          )}

          {/* Media */}
          {mediaUrl && (
            <div className="rounded-xl overflow-hidden mb-3 border border-slate-800 bg-slate-950 max-h-64 flex items-center justify-center">
              {mediaType === 'video' ? (
                <video src={mediaUrl} controls className="w-full max-h-64 object-contain" />
              ) : (
                <img src={mediaUrl} alt="Threads Preview" className="w-full max-h-64 object-cover" />
              )}
            </div>
          )}

          {/* Threads Action Buttons */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-400 text-xs">
            <div className="flex items-center gap-4">
              <Heart className="w-4 h-4 hover:text-rose-500 cursor-pointer transition-colors" />
              <MessageCircle className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
              <Repeat className="w-4 h-4 hover:text-emerald-400 cursor-pointer transition-colors" />
              <Share2 className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
            </div>
            <span className="text-[10px] text-slate-600">Baru saja</span>
          </div>
        </div>
      )}
    </div>
  );
}

