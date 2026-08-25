const { callUnifiedAI } = require('./agent/aiQueueService');

const SYSTEM_PROMPT = `Kamu adalah asisten konten media sosial (social media content assistant).
Buat caption postingan yang menarik, profesional, dan sesuai tone yang diminta.
Gunakan bahasa Indonesia kecuali diminta lain. Sertakan emoji secukupnya dan hashtag yang relevan di akhir.
Jangan menambahkan teks pengantar, langsung berikan caption saja.`;

/**
 * Generate caption menggunakan Unified AI (Groq Primary + Mistral Fallback)
 * @param {{topic: string, tone?: string, platform?: string, length?: 'short'|'medium'|'long'}} opts
 */
async function generateCaption({ topic, tone = 'casual', platform = 'facebook', length = 'medium' }) {
  const lengthMap = { short: '1-2 kalimat', medium: '2-4 kalimat', long: '4-7 kalimat' };
  const prompt = [
    `Topik: ${topic}`,
    `Tone: ${tone}`,
    `Platform: ${platform === 'instagram' ? 'Instagram (caption dengan line breaks yang menarik)' : 'Facebook'}`,
    `Panjang: ${lengthMap[length] || lengthMap.medium}`,
  ].join('\n');

  const caption = await callUnifiedAI({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
    temperature: 0.8,
    maxTokens: 350
  });

  if (!caption) throw new Error('AI tidak mengembalikan caption.');
  return caption.trim();
}

module.exports = { generateCaption };
