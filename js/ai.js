// NexusBooks AI summaries and recommendations
const AI = (() => {
  async function callGemini(prompt) {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Gemini API error');
    return json.text || '';
  }

  async function getBookSummary(bookId, title, description) {
    const { data: cached } = await supabaseClient.from('books')
      .select('ai_summary').eq('id', bookId).single();
    if (cached?.ai_summary) return cached.ai_summary;

    const prompt = `You are a helpful book curator. Given the following ebook information, write a concise 3-sentence summary that highlights what readers will learn and who it's for. Be engaging and direct.

Title: "${title}"
Description: "${description}"

Summary:`;
    const summary = await callGemini(prompt);
    await supabaseClient.from('books').update({ ai_summary: summary }).eq('id', bookId);
    return summary;
  }

  async function getRecommendations(purchasedBooks, allBooks) {
    if (!purchasedBooks.length) return allBooks.slice(0, 4);

    const titles = purchasedBooks.map(b => b.title).join(', ');
    const candidates = allBooks
      .filter(b => !purchasedBooks.find(p => p.id === b.id))
      .slice(0, 20);
    const candidateList = candidates.map((b, i) => `${i}: ${b.title} (${b.category})`).join('\n');

    const prompt = `A reader has enjoyed these books: ${titles}.

From the following list, return ONLY a JSON array of the 4 most relevant index numbers (e.g. [2,5,8,12]):
${candidateList}

JSON array only:`;

    try {
      const raw = await callGemini(prompt);
      const match = raw.match(/\[[\d,\s]+\]/);
      if (!match) return candidates.slice(0, 4);
      const indices = JSON.parse(match[0]);
      return indices.map(i => candidates[i]).filter(Boolean);
    } catch {
      return candidates.slice(0, 4);
    }
  }

  async function generateTags(title, description) {
    const prompt = `Generate 5 short, relevant tags (single words or hyphenated) for an ebook titled "${title}" with description: "${description}". Return as JSON array of strings only.`;
    try {
      const raw = await callGemini(prompt);
      const match = raw.match(/\[.*?\]/s);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [];
    }
  }

  return { getBookSummary, getRecommendations, generateTags };
})();
