const { db } = require('../../config/firebase');

/**
 * Knowledge Synthesizer (Learning Layer)
 * Mengekstrak pola data mentah & eksperimen menjadi aturan/wawasan tindakan (Actionable Insights)
 */

/**
 * Menyintesis wawasan baru dari riwayat memori postingan dan eksperimen
 * @param {string} userId
 */
async function synthesizeKnowledge(userId) {
  try {
    const memorySnap = await db.collection('product_post_memory')
      .where('user_id', '==', userId)
      .limit(200)
      .get();

    if (memorySnap.empty) return [];

    const posts = memorySnap.docs.map(doc => doc.data());
    const insights = [];

    // 1. Sintesis Preferensi Media per Niche & Platform (Video vs Gambar)
    const mediaSegments = {};
    posts.forEach(p => {
      const platform = p.context_at_post?.platform || 'facebook';
      const mediaType = p.context_at_post?.media_type || 'image';
      const niche = p.context_at_post?.target_audience || 'Umum';
      const key = `${platform}__${mediaType}`;

      if (!mediaSegments[key]) {
        mediaSegments[key] = { views: 0, clicks: 0, count: 0, platform, mediaType, niche };
      }
      mediaSegments[key].views += p.raw_metrics?.views || 0;
      mediaSegments[key].clicks += p.raw_metrics?.affiliate_clicks || 0;
      mediaSegments[key].count++;
    });

    // 2. Sintesis Preferensi Jam & Sesi Posting Terbaik (Learned Peak Golden Hours & Sessions)
    const hourStats = {};
    posts.forEach(p => {
      const hour = p.context_at_post?.posting_hour;
      const platform = p.context_at_post?.platform || 'facebook';
      if (hour !== undefined && hour !== null) {
        const key = `${platform}__H${hour}`;
        if (!hourStats[key]) hourStats[key] = { hour, platform, views: 0, clicks: 0, posts: 0 };
        hourStats[key].views += p.raw_metrics?.views || 0;
        hourStats[key].clicks += p.raw_metrics?.affiliate_clicks || 0;
        hourStats[key].posts++;
      }
    });

    // Helper: Klasifikasi jam ke Sesi
    const getSessionFromHour = (h) => {
      if (h >= 5 && h <= 10) return 'Pagi';
      if (h >= 11 && h <= 16) return 'Siang';
      return 'Malam';
    };

    // Evaluasi jam & sesi terbaik per platform
    const platformBestHours = {};
    Object.values(hourStats).forEach(h => {
      if (h.posts >= 1 && (h.views > 0 || h.clicks > 0)) {
        const ctr = h.views > 0 ? h.clicks / h.views : 0.02;
        if (!platformBestHours[h.platform] || ctr > platformBestHours[h.platform].ctr) {
          const session = getSessionFromHour(h.hour);
          platformBestHours[h.platform] = { hour: h.hour, session, ctr, posts: h.posts, clicks: h.clicks, views: h.views };
        }
      }
    });

    for (const [platform, bestH] of Object.entries(platformBestHours)) {
      const insightId = `ins_peak_hour_${platform}`;
      const payload = {
        id: insightId,
        user_id: userId,
        platform,
        insight_type: 'peak_hour_preference',
        finding: `Jam Emas posting di ${platform} terdeteksi pada pukul ${String(bestH.hour).padStart(2, '0')}:00 (Sesi ${bestH.session}, CTR ${(bestH.ctr * 100).toFixed(2)}%)`,
        recommended_action: `SCHEDULE_PRIORITY_AT_${bestH.hour}`,
        data_summary: {
          optimal_hour: bestH.hour,
          optimal_session: bestH.session,
          boost_session: bestH.session,
          sample_posts: bestH.posts,
          total_views: bestH.views,
          total_clicks: bestH.clicks,
          ctr_percent: Number((bestH.ctr * 100).toFixed(2))
        },
        confidence: bestH.posts >= 4 ? 'high' : 'medium',
        updated_at: new Date().toISOString()
      };
      await db.collection('knowledge_insights').doc(insightId).set(payload, { merge: true });
      insights.push(payload);
    }

    // 3. Sintesis Sudut Pandang Copywriting Terbaik (Angle Preference)
    const angleStats = {};
    posts.forEach(p => {
      const angle = p.context_at_post?.copy_angle;
      const platform = p.context_at_post?.platform || 'facebook';
      if (angle) {
        const key = `${platform}__${angle}`;
        if (!angleStats[key]) angleStats[key] = { angle, platform, views: 0, clicks: 0, count: 0 };
        angleStats[key].views += p.raw_metrics?.views || 0;
        angleStats[key].clicks += p.raw_metrics?.affiliate_clicks || 0;
        angleStats[key].count++;
      }
    });

    for (const [key, stat] of Object.entries(angleStats)) {
      if (stat.count >= 3 && stat.views > 0) {
        const ctr = (stat.clicks / stat.views) * 100;
        if (ctr >= 2.0) {
          const insightId = `ins_angle_${key.replace(/[^a-zA-Z0-9_]/g, '_')}`;
          const payload = {
            id: insightId,
            user_id: userId,
            platform: stat.platform,
            insight_type: 'copy_angle_preference',
            finding: `Sudut pandang '${stat.angle}' di ${stat.platform} menghasilkan respon tinggi dengan CTR ${ctr.toFixed(2)}% dari ${stat.count} postingan.`,
            recommended_action: `BOOST_ANGLE_${stat.angle.toUpperCase().replace(/\s+/g, '_')}`,
            data_summary: { angle: stat.angle, sample_count: stat.count, avg_ctr: ctr },
            confidence: stat.count >= 8 ? 'high' : 'medium',
            updated_at: new Date().toISOString()
          };
          await db.collection('knowledge_insights').doc(insightId).set(payload, { merge: true });
          insights.push(payload);
        }
      }
    }

    return insights;
  } catch (err) {
    console.error('[synthesizeKnowledge Error]:', err.message);
    return [];
  }
}

/**
 * Mengambil rekomendasi wawasan aktif untuk panduan Orchestrator
 * @param {string} userId 
 * @param {string} platform 
 */
async function getActiveKnowledgeInsights(userId, platform) {
  try {
    let query = db.collection('knowledge_insights')
      .where('user_id', '==', userId);

    if (platform) {
      query = query.where('platform', '==', platform);
    }

    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[getActiveKnowledgeInsights Error]:', err.message);
    return [];
  }
}

module.exports = {
  synthesizeKnowledge,
  getActiveKnowledgeInsights,
};
