export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI service is not configured' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    });

    const json = await geminiRes.json().catch(() => ({}));
    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: json.error?.message || 'Gemini API error' });
    }

    return res.status(200).json({
      text: json.candidates?.[0]?.content?.parts?.[0]?.text || '',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'AI request failed' });
  }
}
