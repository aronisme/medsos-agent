# 📊 Panduan Lengkap & Dokumentasi Teknis: Modul Analitik Postingan Multi-Platform

Dokumentasi ini merinci arsitektur, skema data, endpoint REST API, cara penggunaan antarmuka, serta cara kerja sistem pelacakan performa (*Velocity & Snapshots*) yang dirancang sebagai fondasi data bagi **AI Content Manager Agent**.

---

## 📑 Daftar Isi
1. [Arsitektur & Konsep Sistem](#1-arsitektur--konsep-sistem)
2. [Struktur File & Modul](#2-struktur-file--modul)
3. [Detail Metrik per Platform](#3-detail-metrik-per-platform)
4. [Skema Data Firestore (Dual-Layer & Snapshots)](#4-skema-data-firestore-dual-layer--snapshots)
5. [Daftar REST API Endpoints](#5-daftar-rest-api-endpoints)
6. [Panduan Penggunaan di Frontend](#6-panduan-penggunaan-di-frontend)
7. [Cara AI Content Manager Agent Memanfaatkan Data Ini](#7-cara-ai-content-manager-agent-memanfaatkan-data-ini)
8. [Pemecahan Masalah (Troubleshooting)](#8-pemecahan-masalah-troubleshooting)

---

## 1. Arsitektur & Konsep Sistem

Sistem analitik ini mengintegrasikan **3 Platform Sosial Media (Facebook, Instagram, Threads)** dan **1 Sistem Tracking Link Afiliasi Internal** ke dalam pipeline data terpadu:

```text
                  META APIs (v21.0 & Threads v1.0)
                                 │
           ┌─────────────────────┼─────────────────────┐
           ↓                     ↓                     ↓
  facebookAnalytics.js  instagramAnalytics.js  threadsAnalytics.js
           │                     │                     │
           └─────────────────────┼─────────────────────┘
                                 │ (Promise.allSettled)
                                 ↓
                           normalizer.js
                                 │
                    ┌────────────┴────────────┐
                    ↓                         ↓
           Standardized Metrics         Raw API Data
                    │                         │
                    └────────────┬────────────┘
                                 ↓
                        linkMatcher.js (Firestore short_links)
                                 │
                                 ↓
                     post_analytics (Firestore)
                                 │
                                 ↓
                        snapshotService.js
                  (Deterministic Bucket ID: 30-min dedup)
                                 │
                                 ↓
                   post_analytics_snapshots (Firestore)
                                 │
                                 ↓
                      REST API Router (/api/analytics/posts)
                                 │
                                 ↓
                    PostAnalytics.jsx (Frontend UI)
                                 │
                                 ↓
                    AI Content Manager Agent (Engine)
```

### Prinsip Utama:
1. **Raw ≠ Normalized (Dual-Layer)**: Data asli dari Meta (`raw`) disimpan utuh tanpa dibuang untuk keperluan audit/perubahan API, berdampingan dengan skema standar (`metrics`).
2. **Tidak Ada Formula Semu**: Metrik yang disimpan adalah murni data mentah langsung dari API. Formula analitik / skor diserahkan ke layer AI.
3. **Resilient Sync**: Menggunakan `Promise.allSettled()`. Jika salah satu platform mengalami kendala token, platform lainnya tetap berhasil disinkronkan.
4. **Data Provenance**: Setiap metrik memiliki metadata sumber (`metric_source`), sehingga AI mengetahui asal data (apakah dari `meta_api` atau `firestore`).
5. **Velocity Tracking**: Snapshot berkala mencatat riwayat pertumbuhan views/engagement untuk menghitung laju percepatan konten.

---

## 2. Struktur File & Modul

```text
backend/src/
├── services/
│   └── postAnalytics/
│       ├── facebookAnalytics.js   # Adapter API Facebook Page Feed & Reactions
│       ├── instagramAnalytics.js  # Adapter API Instagram Media & Insights v21
│       ├── threadsAnalytics.js    # Adapter API Threads Posts & Insights v1.0
│       ├── linkMatcher.js         # Ekstraktor URL & Pencocok Database Shortlinks
│       ├── normalizer.js          # Skema Standardisasi + Provenance Metadata
│       ├── snapshotService.js     # Time-series Snapshot & Velocity Engine
│       └── syncService.js         # Orkestrator Sinkronisasi Multi-Platform
├── routes/
│   └── post-analytics.js          # REST API Router untuk Analitik Postingan
└── app.js                         # Mount route pada /api/analytics/posts

frontend/src/
├── components/
│   ├── PostAnalytics.jsx          # Tab Dashboard Analitik & History Modal
│   └── Sidebar.jsx                # Menu Navigasi "Analitik Postingan"
└── App.jsx                        # View Router Tab post_analytics
```

---

## 3. Detail Metrik per Platform

| Platform | Endpoint Meta API | Metrik Mentah yang Dilacak | Catatan Khusus |
|---|---|---|---|
| **Facebook** | `/{page_id}/feed` | • Likes / Reactions<br>• Comments<br>• Shares<br>• Attachments (Photo/Video/Album) | Jangkauan pada endpoint feed diambil dari summary reactions/comments/shares. |
| **Instagram** | `/{ig_user_id}/media`<br>`/{media_id}/insights` | • Views / Plays<br>• Reach<br>• Likes<br>• Comments<br>• Shares<br>• Saved (Bookmark)<br>• Video Watch Time | Metrik `views` & `watch_time` berlaku untuk Reels/Video. Post gambar menggunakan `reach` & `saved`. |
| **Threads** | `/me/threads`<br>`/{thread_id}/insights` | • Views<br>• Likes<br>• Replies<br>• Reposts<br>• Quotes | Menggunakan Threads Graph API v1.0 dengan token khusus Threads. |
| **Afiliasi** | Firestore `short_links`<br>`link_clicks` | • Total Clicks<br>• Human Clicks<br>• Destination URL | Dicocokkan otomatis jika caption memuat pola link `/s/{code}`. |

---

## 4. Skema Data Firestore (Dual-Layer & Snapshots)

### A. Koleksi `post_analytics` (Dokumen Postingan Terpadu)
*ID Dokumen:* `{platform}_{raw_post_id}` (Contoh: `facebook_1189479757592436_122100516813444561`)

```json
{
  "id": "instagram_18149935615515255",
  "user_id": "uJhx9rqu8QXrhBELW56nclJNRyk2",
  "identity": {
    "platform": "instagram",
    "account_id": "17841434113482134",
    "account_name": "Nazilla",
    "username": "nazillaisme",
    "post_id": "18149935615515255",
    "permalink": "https://www.instagram.com/p/C_abc123/"
  },
  "content": {
    "caption": "🔥 REKOMENDASI PRODUK POPULER 🔥\n\nFresh Vision Madu Herbal...",
    "media_type": "VIDEO",
    "thumbnail_url": "https://scontent.cdninstagram.com/...",
    "published_at": "2026-08-18T01:05:03.000Z"
  },
  "metrics": {
    "views": 1250,
    "reach": 890,
    "likes": 45,
    "comments": 6,
    "shares": 12,
    "saves": 18,
    "replies": null,
    "reposts": null,
    "quotes": null
  },
  "video_metrics": {
    "avg_watch_time": 9.4,
    "total_view_time": 11750
  },
  "metric_source": {
    "views": "meta_api",
    "reach": "meta_api",
    "likes": "meta_api",
    "comments": "meta_api",
    "shares": "meta_api",
    "saves": "meta_api",
    "affiliate_clicks": "firestore"
  },
  "affiliate": {
    "short_links": [
      {
        "code": "8CTKjO",
        "url": "http://shopee-link-aff.vercel.app/s/8CTKjO",
        "title": "Fresh Vision Madu Herbal",
        "total_clicks": 42,
        "human_clicks": 38
      }
    ],
    "total_clicks": 42,
    "human_clicks": 38
  },
  "raw": {
    "post_response": { "...": "original Meta post object" },
    "insights_response": [ { "...": "original Meta insights array" } ]
  },
  "sync": {
    "first_synced_at": "2026-08-18T13:21:00.000Z",
    "last_synced_at": "2026-08-18T13:45:00.000Z",
    "status": "success",
    "error": null
  }
}
```

---

### B. Koleksi `post_analytics_snapshots` (Data Deret Waktu / History)
*ID Dokumen (Deterministik 30 Menit):* `{post_id}_{YYYYMMDD_HHmm}` (Contoh: `instagram_18149935615515255_20260818_2030`)

```json
{
  "id": "instagram_18149935615515255_20260818_2030",
  "post_id": "instagram_18149935615515255",
  "platform": "instagram",
  "user_id": "uJhx9rqu8QXrhBELW56nclJNRyk2",
  "time_bucket": "20260818_2030",
  "captured_at": "2026-08-18T13:30:15.123Z",
  "metrics": {
    "views": 1250,
    "likes": 45,
    "comments": 6,
    "shares": 12,
    "saves": 18
  },
  "video_metrics": {
    "avg_watch_time": 9.4,
    "total_view_time": 11750
  },
  "affiliate_clicks": 38
}
```

*Keuntungan ID Deterministik:* Jika user menekan tombol sinkronisasi berkali-kali dalam 30 menit yang sama, dokumen hanya di-update/overwrite, bukan menduplikasi data di Firestore.

---

## 5. Daftar REST API Endpoints

Semua endpoint dilindungi oleh middleware otentikasi JWT (`Authorization: Bearer <token>`).

### 1. `GET /api/analytics/posts`
Mengambil daftar postingan ternormalisasi.
* **Query Parameters:**
  * `platform`: `all` (default), `facebook`, `instagram`, `threads`
  * `sortBy`: `newest` (default), `views`, `likes`, `comments`, `shares`, `clicks`, `oldest`
  * `q`: Kata kunci pencarian caption / ID
  * `limit`: Jumlah data per halaman (default: `50`)
* **Response Contoh:**
  ```json
  {
    "success": true,
    "count": 29,
    "last_synced_at": "2026-08-18T13:21:00.000Z",
    "posts": [ { "id": "...", "identity": {}, "metrics": {} } ]
  }
  ```

### 2. `GET /api/analytics/posts/summary`
Mengambil akumulasi angka mentah global & per platform.
* **Response Contoh:**
  ```json
  {
    "success": true,
    "global": {
      "total_posts": 29,
      "total_views": 345,
      "total_likes": 2,
      "total_comments": 1,
      "total_shares": 0,
      "total_saves": 0,
      "total_affiliate_clicks": 82
    },
    "platforms": {
      "facebook": { "posts": 10, "likes": 0, "comments": 0, "shares": 0, "affiliate_clicks": 41 },
      "instagram": { "posts": 9, "views": 54, "likes": 1, "comments": 1, "shares": 0, "saves": 0, "affiliate_clicks": 41 },
      "threads": { "posts": 10, "views": 291, "likes": 1, "replies": 0, "reposts": 0, "quotes": 0, "affiliate_clicks": 0 }
    }
  }
  ```

### 3. `GET /api/analytics/posts/status`
Memeriksa status konektivitas akun Meta.
* **Response Contoh:**
  ```json
  {
    "success": true,
    "platforms": {
      "facebook": { "connected": true, "account_name": "Airish Aisya" },
      "instagram": { "connected": true, "account_name": "Nazilla" },
      "threads": { "connected": true, "account_name": "Nazilla (@zilla_hida)" }
    }
  }
  ```

### 4. `POST /api/analytics/posts/sync`
Memicu sinkronisasi data langsung dari Meta API.
* **Response Contoh:**
  ```json
  {
    "success": true,
    "synced_at": "2026-08-18T13:20:50.000Z",
    "results": {
      "facebook": { "status": "success", "count": 10, "error": null },
      "instagram": { "status": "success", "count": 9, "error": null },
      "threads": { "status": "success", "count": 10, "error": null }
    },
    "total_posts_synced": 29
  }
  ```

### 5. `GET /api/analytics/posts/:id/history`
Mengambil deret waktu snapshot per post beserta kalkulasi *velocity* (pertumbuhan views/jam).
* **Response Contoh:**
  ```json
  {
    "success": true,
    "post_id": "threads_17952599343017373",
    "count": 3,
    "history": [
      {
        "time_bucket": "20260818_1800",
        "captured_at": "2026-08-18T11:00:00.000Z",
        "metrics": { "views": 200, "likes": 10 },
        "delta": { "views": 0, "hours_elapsed": 0, "views_velocity_per_hour": 0 }
      },
      {
        "time_bucket": "20260818_2000",
        "captured_at": "2026-08-18T13:00:00.000Z",
        "metrics": { "views": 1200, "likes": 65 },
        "delta": { "views": 1000, "hours_elapsed": 2.0, "views_velocity_per_hour": 500.0 }
      }
    ]
  }
  ```

---

## 6. Panduan Penggunaan di Frontend

Buka aplikasi dan pilih tab **"Analitik Postingan"** di sidebar menu:

1. **Memeriksa Status Akun**:
   Periksa bilah hijau di bagian atas untuk memastikan Facebook, Instagram, dan Threads berstatus **Connected**.
2. **Sinkronisasi Data**:
   Klik tombol **"Sync from Meta"** untuk menarik data terbaru. Waktu sinkronisasi terakhir akan diperbarui otomatis.
3. **Filter & Pencarian**:
   * Klik tab platform (**Semua / Facebook / Instagram / Threads**) untuk memfilter sumber postingan.
   * Gunakan kotak pencarian untuk mencari kata kunci tertentu di caption (misal: "Madu", "Sepatu").
   * Gunakan dropdown pengurutan untuk melihat postingan berdasarkan: *Views Terbanyak*, *Likes Terbanyak*, *Komentar Terbanyak*, atau *Klik Afiliasi Terbanyak*.
4. **Melihat Velocity & Raw Payload**:
   Klik tombol **"Velocity & Raw Data"** pada setiap kartu postingan:
   * **Tab Velocity**: Melihat grafik laju pertumbuhan views per jam dari postingan tersebut.
   * **Tab Normalized**: Memeriksa skema JSON terpadu.
   * **Tab Raw Meta API**: Memeriksa respon asli dari server Meta (bisa disalin dengan tombol *Salin JSON*).
5. **Ekspor Data**:
   Klik tombol **"Export"** di kanan atas untuk mengunduh:
   * **Normalized JSON**: Untuk backup dan input model data AI.
   * **Raw Meta API JSON**: Untuk audit teknis API.
   * **CSV**: Untuk laporan Excel atau spreadsheet.

---

## 7. Cara AI Content Manager Agent Memanfaatkan Data Ini

Di tahap pengembangan berikutnya saat membangun **Agent Manager Konten**, Agent dapat memanggil endpoint `/api/analytics/posts` dan `/api/analytics/posts/:id/history` untuk mengambil keputusan berbasis data:

### A. Mendeteksi Konten Viral & Akselerasi Cepat (*Velocity Detection*)
* **Cara Kerja Agent:** Agent membandingkan `delta.views_velocity_per_hour`.
* **Keputusan Otomatis:** Jika ada video yang memiliki velocity $> 200\text{ views/jam}$ dalam 4 jam pertama, Agent menandai video tersebut sebagai **"Trending Spike"** dan menyarankan pembuatan konten part 2 / versi variasi di hari berikutnya.

### B. Menemukan Jam Emas Posting (*Smart Heatmap Scheduling*)
* **Cara Kerja Agent:** Agent mengelompokkan `published_at` vs `views` dan `likes`.
* **Keputusan Otomatis:** Agent menentukan jam posting paling produktif secara dinamis (misal: jam 19.30 WIB) dan secara mandiri menjadwalkan konten baru pada slot jam tersebut.

### C. Menghubungkan Konten ke Konversi Penjualan (*Content-to-Affiliate Attribution*)
* **Cara Kerja Agent:** Agent menghubungkan data `content.media_type` + `content.caption` + `affiliate.human_clicks`.
* **Keputusan Otomatis:** Agent mengidentifikasi produk dan gaya copywriting yang menghasilkan klik tertinggi:
  > *"Produk Madu Herbal dengan format video Reels 10 detik menghasilkan rasio konversi klik 3.8x lipat lebih tinggi dibanding postingan gambar statis. Mengalokasikan 70% jadwal minggu depan untuk produk ini."*

---

## 8. Pemecahan Masalah (Troubleshooting)

| Masalah / Error | Penyebab | Solusi |
|---|---|---|
| **Token Expired / Invalid** | Token Meta user telah kadaluarsa. | Perbarui token di menu Akun Sosmed atau jalankan script update token dengan token baru dari Meta Developer. |
| **`views` bernilai null pada Facebook Post** | Facebook Page Feed API tidak menyertakan metrik video views di feed endpoint biasa. | Normal. Facebook menggunakan akumulasi *Reactions*, *Comments*, dan *Shares* sebagai tolok ukur engagement utama feed. |
| **Tidak ada klik afiliasi terdeteksi** | Caption postingan tidak memuat link `/s/{code}` internal. | Pastikan saat membuat postingan menggunakan fitur shortlink generator atau mencantumkan domain tracker internal aplikasi. |
| **Snapshot tidak bertambah saat Sync berkali-kali** | Sistem deduplikasi bucket 30 menit aktif. | Normal. Snapshot dirancang untuk merekam interval waktu, bukan klik berulang per detik. Coba sinkronkan kembali setelah interval 30 menit. |

---

*Dokumentasi ini dibuat pada: 18 Agustus 2026*  
*Repository:* `https://github.com/aronisme/medsos-agent`
