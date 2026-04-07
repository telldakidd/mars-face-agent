import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const NEWS_API_KEY = process.env.NEWS_API_KEY ?? "";

export interface SentimentResult {
  headline: string;
  sentiment: "bullish" | "bearish" | "neutral";
  score: number;
}

export async function getNewsSentiment(symbol: string): Promise<SentimentResult[]> {
  // Fetch top 5 recent headlines
  const q = encodeURIComponent(symbol);
  const url = `https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${NEWS_API_KEY}`;

  let headlines: string[] = [];
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as { articles: { title: string }[] };
      headlines = (data.articles ?? []).map((a) => a.title).filter(Boolean);
    }
  } catch {
    // fall through — use fallback
  }

  if (headlines.length === 0) {
    return [{ headline: `No recent news found for ${symbol}`, sentiment: "neutral", score: 0 }];
  }

  const prompt = `You are a financial news sentiment analyst.

For each headline below, classify sentiment for the asset "${symbol}" as:
- "bullish" — positive for the asset price
- "bearish" — negative for the asset price
- "neutral" — no clear directional impact

Also give a confidence score from 0.0 to 1.0.

Return ONLY a JSON array in this exact format, no other text:
[{"headline":"...", "sentiment":"bullish|bearish|neutral", "score": 0.0-1.0}, ...]

Headlines:
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const parsed = JSON.parse(text) as SentimentResult[];
    return parsed;
  } catch {
    // Return unscored results on parse failure
    return headlines.map((h) => ({ headline: h, sentiment: "neutral" as const, score: 0.5 }));
  }
}
