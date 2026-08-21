/**
 * Multi-Gate Decision Evaluator untuk menentukan apakah kandidat boleh diproses secara Semi-Auto
 * atau wajib masuk antrean review manual (SAFE Mode)
 * @param {Object} candidate 
 * @param {'SAFE'|'SEMI_AUTO'} mode 
 */
function evaluateOutboundGate(candidate, mode = 'SAFE') {
  // Dalam mode SAFE (default), selalu wajibkan persetujuan manusia
  if (mode !== 'SEMI_AUTO') {
    return {
      autoDispatchEligible: false,
      recommendedStatus: 'PENDING',
      reason: 'Mode SAFE aktif: Memerlukan persetujuan manual pengguna.',
    };
  }

  const buyingIntent = Number(candidate.buying_intent_score) || 0;
  const relevance = Number(candidate.relevance_score) || 0;

  // Gerbang 1: Skor Niat Beli & Relevansi ketat (>= 0.92)
  if (buyingIntent < 0.92 || relevance < 0.92) {
    return {
      autoDispatchEligible: false,
      recommendedStatus: 'PENDING',
      reason: `Skor di bawah ambang semi-auto 92% (Intent: ${buyingIntent}, Relevansi: ${relevance}).`,
    };
  }

  // Gerbang 2: Usia Postingan tidak boleh lebih dari 6 jam untuk auto-reply
  if (candidate.post_timestamp) {
    const ageHours = (Date.now() - new Date(candidate.post_timestamp).getTime()) / (1000 * 60 * 60);
    if (ageHours > 6) {
      return {
        autoDispatchEligible: false,
        recommendedStatus: 'PENDING',
        reason: 'Usia postingan > 6 jam, dialihkan ke persetujuan manual.',
      };
    }
  }

  return {
    autoDispatchEligible: true,
    recommendedStatus: 'QUEUED',
    reason: 'Memenuhi seluruh kriteria multi-gate Semi-Auto.',
  };
}

module.exports = {
  evaluateOutboundGate,
};
