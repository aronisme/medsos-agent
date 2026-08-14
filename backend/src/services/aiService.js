const axios = require('axios');
const env = require('../config/env');

const SYSTEM_PROMPT = `Kamu adalah asisten konten media sosial (social media content assistant).
Buat caption postingan yang menarik, profesional, dan sesuai tone yang diminta.
Gunakan bahasa Indonesia kecuali diminta lain. Sertakan emoji secukupnya dan hashtag yang relevan di akhir.
Jangan menambahkan teks pengantar, langsung berikan caption saja.`;

/**
 * Generate caption menggunakan Mistral AI
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

  const response = await axios.post(
    'https://api.mistral.ai/v1/chat/completions',
    {
      model: env.mistralModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.8,
    },
    { headers: { Authorization: `Bearer ${env.mistralApiKey}` } }
  );

  const caption = response.data?.choices?.[0]?.message?.content?.trim();
  if (!caption) throw new Error('Mistral tidak mengembalikan caption.');
  return caption;
}

module.exports = { generateCaption };
