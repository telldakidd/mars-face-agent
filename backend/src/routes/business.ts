import { Router, type Request, type Response } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

export const businessRouter = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

// ── POST /api/business/content ────────────────────────────────────────────────

const ContentBodySchema = z.object({
  clientId: z.string(),
  platform: z.string().min(1),
  topic: z.string().min(1),
  style: z.string().min(1),
});

businessRouter.post("/content", async (req: Request, res: Response) => {
  const parsed = ContentBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { platform, topic, style } = parsed.data;

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: `You are an expert social media content strategist. Generate viral content for ${platform}. Always respond with valid JSON only, no markdown.`,
      messages: [
        {
          role: "user",
          content: `Create a ${style} post about: ${topic}. Return JSON with exactly these fields:
- hook: attention-grabbing first line, max 15 words
- caption: main body text, optimized for ${platform}
- hashtags: comma-separated hashtags, platform-appropriate
- cta: call to action, 1 sentence

Return only the JSON object, no extra text.`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let draft: { hook: string; caption: string; hashtags: string; cta: string };
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      draft = JSON.parse(cleaned);
    } catch {
      // Fallback: extract from text
      draft = {
        hook: "Your audience is waiting for this.",
        caption: text.slice(0, 500),
        hashtags: `#${platform.toLowerCase()} #${topic.toLowerCase().replace(/\s+/g, "")} #content`,
        cta: "Follow for more insights.",
      };
    }

    res.json({ ...draft, platform });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/business/proposal ──────────────────────────────────────────────

const ProposalBodySchema = z.object({
  clientId: z.string().min(1),
  clientName: z.string().min(1),
  service: z.string().min(1),
  price: z.union([z.string(), z.number()]),
  keyPoints: z.array(z.string()).min(1),
});

businessRouter.post("/proposal", async (req: Request, res: Response) => {
  const parsed = ProposalBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { clientName, service, price, keyPoints } = parsed.data;

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system:
        "You are a professional business proposal writer. Write compelling, structured proposals that win clients. Write in clear, professional prose.",
      messages: [
        {
          role: "user",
          content: `Write a professional business proposal (400-500 words) with the following details:
- Client Name: ${clientName}
- Service: ${service}
- Price: ${price}
- Key Points: ${keyPoints.join(", ")}

The proposal should include: an executive summary, the problem being solved, the proposed solution, key deliverables, pricing, and a call to action. Write it as ready-to-send prose.`,
        },
      ],
    });

    const proposal = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    res.json({ proposal });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/business/trends ──────────────────────────────────────────────────

businessRouter.get("/trends", async (_req: Request, res: Response) => {
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: "You are a business intelligence analyst. Respond with valid JSON only, no markdown.",
      messages: [
        {
          role: "user",
          content: `List 5 current business and entrepreneurship trends that creators and entrepreneurs should know about right now. Return a JSON array with exactly 5 objects, each with:
- topic: trend name (short, 2-5 words)
- trendScore: number 0-100 indicating momentum
- opportunity: one sentence explaining the opportunity for creators/entrepreneurs

Return only the JSON array, no extra text.`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let trends: Array<{ topic: string; trendScore: number; opportunity: string }>;
    try {
      const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      trends = JSON.parse(cleaned);
    } catch {
      trends = [
        { topic: "AI-Powered Automation", trendScore: 95, opportunity: "Businesses using AI agents are cutting costs 40% while scaling faster." },
        { topic: "Creator Economy 3.0", trendScore: 88, opportunity: "Micro-creators with 10K followers earning more than traditional media." },
        { topic: "Short-Form Video Commerce", trendScore: 82, opportunity: "TikTok Shop and Reels are generating 5x ROI vs traditional ads." },
        { topic: "B2B SaaS Niching", trendScore: 76, opportunity: "Hyper-specific vertical SaaS tools commanding premium pricing." },
        { topic: "Personal Brand Arbitrage", trendScore: 71, opportunity: "Building a personal brand first, then launching products to warm audiences." },
      ];
    }

    res.json(trends);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
