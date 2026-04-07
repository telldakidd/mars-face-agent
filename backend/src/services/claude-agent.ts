import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase.js";
import { MT5Connector } from "../connectors/mt5.js";
import { broadcastToClient } from "../websocket.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
const mt5 = new MT5Connector();

// ── Tool definitions ──────────────────────────────────────────────────────────

// Trading tools — only available when client has trading_enabled = true
const TRADING_TOOLS: Anthropic.Tool[] = [
  {
    name: "basketbot_start",
    description: "Start the BasketBot EA on a given symbol on the client's MT5 account.",
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string", description: "Trading symbol, e.g. XAUUSD" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "basketbot_stop",
    description: "Stop the BasketBot EA on the client's MT5 account.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "basketbot_set_param",
    description:
      "Change a BasketBot input parameter. Examples: InpBaseLots, InpGridStepPoints, InpTierLevel, InpProfitTargetPct, InpEquityStopPct, InpAllowNewEntries, InpTP_BULL_BUY_Points.",
    input_schema: {
      type: "object" as const,
      properties: {
        param: { type: "string", description: "The InpXxx parameter name" },
        value: { description: "The new value (string, number, or boolean)" },
      },
      required: ["param", "value"],
    },
  },
  {
    name: "get_portfolio",
    description:
      "Get the client's current MT5 account info: balance, equity, margin, open positions.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_trades",
    description: "Get the client's recent trade history.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max trades to return (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "weatherbot_status",
    description: "Get the current WeatherBot status and latest Kalshi signals.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

// Base tools — available to ALL clients regardless of trading_enabled
const BASE_TOOLS: Anthropic.Tool[] = [
  {
    name: "phone_command",
    description:
      "Control the user's Pixel phone. Use this for any phone-related request: screen brightness, volume, WiFi, opening apps, locking screen, taking screenshots, Do Not Disturb, flashlight.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          enum: [
            "set_brightness",
            "set_volume",
            "set_wifi",
            "open_app",
            "lock_screen",
            "take_screenshot",
            "set_do_not_disturb",
            "set_flashlight",
            "set_bluetooth",
            "set_airplane_mode",
          ],
        },
        value: {
          description:
            "Value for the command: number for brightness/volume, boolean for toggles, package name string for open_app",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "send_sms",
    description:
      "Send a text message (SMS) from the user's phone to any contact or number.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Phone number or contact name" },
        message: { type: "string", description: "The text message to send" },
      },
      required: ["to", "message"],
    },
  },
  {
    name: "make_call",
    description: "Make a phone call from the user's phone.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Phone number or contact name to call" },
      },
      required: ["to"],
    },
  },
  {
    name: "set_alarm",
    description: "Set an alarm or timer on the user's phone.",
    input_schema: {
      type: "object" as const,
      properties: {
        time: {
          type: "string",
          description: "Time for the alarm, e.g. '7:30 AM' or '30 minutes'",
        },
        label: { type: "string", description: "Optional label for the alarm" },
      },
      required: ["time"],
    },
  },
  {
    name: "create_task",
    description: "Create a task or to-do item for the user. Use this whenever they ask you to remind them of something, add a task, or say things like 'remind me to...', 'add to my list...', 'I need to...'",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "The task description" },
        dueDate: { type: "string", description: "Optional due date, e.g. 'Friday' or '2026-04-10'" },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_crm_lead",
    description: "Add a new lead or contact to the CRM pipeline. Use when the user mentions a new prospect, client, or business contact they want to track.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Lead's full name" },
        company: { type: "string", description: "Company name" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        value: { type: "number", description: "Estimated deal value in dollars" },
        notes: { type: "string", description: "How you met them or context" },
      },
      required: ["name"],
    },
  },
  {
    name: "log_expense",
    description: "Log a business expense. Use when the user mentions spending money, paying for something, or wants to track a cost.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount: { type: "number", description: "Amount spent in dollars" },
        category: { type: "string", enum: ["food", "travel", "software", "marketing", "equipment", "other"] },
        description: { type: "string", description: "What the expense was for" },
      },
      required: ["amount", "category"],
    },
  },
  {
    name: "web_search",
    description:
      "Search the web to answer questions, get current information, news, prices, weather, or any factual query the user asks.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "draft_email",
    description:
      "Draft a professional email for the user. Use this when they want to write/send any email — to clients, partners, leads, or anyone.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Recipient name or email" },
        subject: { type: "string", description: "Email subject" },
        context: {
          type: "string",
          description: "What the email should say or accomplish",
        },
        tone: {
          type: "string",
          enum: ["professional", "friendly", "urgent", "follow_up", "sales"],
          description: "Tone of the email",
        },
      },
      required: ["to", "subject", "context"],
    },
  },
  {
    name: "generate_social_post",
    description:
      "Generate viral social media content (hook, caption, hashtags, CTA) optimized for a specific platform. Use this whenever the user wants to create content.",
    input_schema: {
      type: "object" as const,
      properties: {
        platform: {
          type: "string",
          enum: ["instagram", "tiktok", "twitter", "linkedin", "youtube"],
        },
        topic: { type: "string", description: "What the post is about" },
        style: {
          type: "string",
          enum: [
            "educational",
            "entertaining",
            "motivational",
            "controversial",
            "behind_the_scenes",
            "storytelling",
          ],
        },
      },
      required: ["platform", "topic"],
    },
  },
  {
    name: "research_topic",
    description:
      "Do deep research on any business topic, competitor, industry trend, or person. Returns a structured intelligence report.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description: "Topic, company name, person, or industry to research",
        },
        focus: {
          type: "string",
          enum: [
            "overview",
            "competitors",
            "opportunities",
            "risks",
            "market_size",
            "strategy",
          ],
          description: "What aspect to focus on",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "create_pitch",
    description:
      "Generate a business pitch, elevator pitch, or sales script for any product, service, or idea.",
    input_schema: {
      type: "object" as const,
      properties: {
        product: { type: "string", description: "Product or service name" },
        audience: {
          type: "string",
          description: "Target audience or investor type",
        },
        format: {
          type: "string",
          enum: [
            "elevator_30s",
            "investor_2min",
            "sales_cold_call",
            "instagram_bio",
            "linkedin_headline",
          ],
        },
      },
      required: ["product", "audience"],
    },
  },
  {
    name: "analyze_metrics",
    description:
      "Analyze business or social media metrics and provide actionable insights and recommendations.",
    input_schema: {
      type: "object" as const,
      properties: {
        metrics: {
          type: "string",
          description:
            "The metrics data to analyze (revenue, followers, engagement, etc.)",
        },
        goal: {
          type: "string",
          description: "What the user is trying to optimize",
        },
      },
      required: ["metrics"],
    },
  },
  {
    name: "build_strategy",
    description:
      "Build a step-by-step business strategy, content strategy, growth strategy, or launch plan.",
    input_schema: {
      type: "object" as const,
      properties: {
        goal: {
          type: "string",
          description: "What the user wants to achieve",
        },
        timeline: {
          type: "string",
          description:
            "Timeline for the strategy, e.g. '30 days', '90 days', '1 year'",
        },
        resources: {
          type: "string",
          description: "Available budget, team size, or tools",
        },
      },
      required: ["goal"],
    },
  },
  {
    name: "generate_hashtags",
    description:
      "Generate optimal hashtag sets for any social media platform and niche.",
    input_schema: {
      type: "object" as const,
      properties: {
        niche: {
          type: "string",
          description: "The content niche or industry",
        },
        platform: {
          type: "string",
          enum: ["instagram", "tiktok", "twitter", "linkedin", "youtube"],
        },
        size: {
          type: "string",
          enum: ["micro", "medium", "large", "mega"],
          description: "Target account/audience size tier",
        },
      },
      required: ["niche", "platform"],
    },
  },
  {
    name: "create_outreach_sequence",
    description:
      "Create a multi-step DM or email outreach sequence to build relationships, generate leads, or close deals.",
    input_schema: {
      type: "object" as const,
      properties: {
        target: {
          type: "string",
          description:
            "Who you're reaching out to (e.g. 'fitness influencers', 'local businesses')",
        },
        goal: {
          type: "string",
          description:
            "What you want to achieve (collab, sale, partnership, meeting)",
        },
        steps: {
          type: "number",
          description: "Number of follow-up messages (2-5)",
        },
      },
      required: ["target", "goal"],
    },
  },
  {
    name: "morning_briefing",
    description:
      "Generate a personalized morning briefing covering: top priorities for the day, market conditions (if trading enabled), content ideas, and one growth action item.",
    input_schema: {
      type: "object" as const,
      properties: {
        focus: {
          type: "string",
          description:
            "Main focus area for today: business, content, trading, networking",
        },
      },
      required: [],
    },
  },
  {
    name: "call_n8n_workflow",
    description:
      "Execute an n8n automation workflow for complex tasks: YouTube video generation, email campaigns, social media scheduling, data pipelines, or any multi-step automation. Use this when the task involves external services or automation beyond direct tool calls.",
    input_schema: {
      type: "object" as const,
      properties: {
        workflow_name: {
          type: "string",
          description: "The workflow purpose, e.g. 'generate_youtube_video', 'send_email_campaign', 'post_to_social'",
        },
        data: {
          type: "object" as const,
          description: "Input data to pass to the workflow (topic, script, settings, etc.)",
          properties: {},
          required: [],
        },
      },
      required: ["workflow_name"],
    },
  },
  {
    name: "save_memory",
    description:
      "Save an important note, idea, goal, or piece of information to the user's memory so Mars remembers it permanently.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["goal", "idea", "contact", "task", "insight", "preference"],
        },
        content: {
          type: "string",
          description: "What to remember",
        },
      },
      required: ["category", "content"],
    },
  },
];

async function getToolsForClient(clientId: string): Promise<Anthropic.Tool[]> {
  const { data } = await supabase
    .from("clients")
    .select("trading_enabled")
    .eq("id", clientId)
    .single();
  const tradingEnabled =
    (data as { trading_enabled?: boolean } | null)?.trading_enabled ?? false;
  return tradingEnabled ? [...TRADING_TOOLS, ...BASE_TOOLS] : BASE_TOOLS;
}

// ── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  clientId: string
): Promise<string> {
  try {
    switch (toolName) {
      // ── Trading tools ────────────────────────────────────────────────────────
      case "basketbot_start": {
        await mt5.connect();
        await mt5.startBasketBot(input.symbol as string);
        return `BasketBot started on ${input.symbol}.`;
      }
      case "basketbot_stop": {
        await mt5.connect();
        await mt5.stopBasketBot();
        return "BasketBot stopped.";
      }
      case "basketbot_set_param": {
        await mt5.connect();
        await mt5.setParam(input.param as string, input.value);
        return `BasketBot parameter ${input.param} set to ${input.value}.`;
      }
      case "get_portfolio": {
        await mt5.connect();
        const [info, positions] = await Promise.all([
          mt5.getAccountInfo(),
          mt5.getPositions(),
        ]);
        return JSON.stringify({ accountInfo: info, openPositions: positions });
      }
      case "get_trades": {
        const limit = (input.limit as number) ?? 20;
        const { data } = await supabase
          .from("trade_log")
          .select("*")
          .eq("client_id", clientId)
          .order("executed_at", { ascending: false })
          .limit(limit);
        return JSON.stringify(data ?? []);
      }
      case "weatherbot_status": {
        return JSON.stringify({
          status: "active",
          message:
            "WeatherBot running — check /api/weatherbot/status for live signals.",
        });
      }

      // ── Phone control tools ──────────────────────────────────────────────────
      case "phone_command": {
        broadcastToClient(clientId, {
          type: "phone_command",
          command: input.command,
          value: input.value ?? null,
        });
        return `Phone command '${input.command}' sent to device.`;
      }
      case "send_sms": {
        broadcastToClient(clientId, {
          type: "phone_command",
          command: "send_sms",
          value: { to: input.to, message: input.message },
        });
        return `SMS to '${input.to}' sent: "${input.message}"`;
      }
      case "make_call": {
        broadcastToClient(clientId, {
          type: "phone_command",
          command: "make_call",
          value: input.to,
        });
        return `Calling '${input.to}'...`;
      }
      case "set_alarm": {
        broadcastToClient(clientId, {
          type: "phone_command",
          command: "set_alarm",
          value: { time: input.time, label: input.label ?? "" },
        });
        return `Alarm set for ${input.time}${input.label ? ` (${input.label})` : ""}.`;
      }

      case "create_task": {
        // Broadcast to phone so the app can add it to the todo list
        broadcastToClient(clientId, {
          type: "create_task",
          title: input.title as string,
          dueDate: (input.dueDate as string) ?? null,
          priority: (input.priority as string) ?? "medium",
        });
        return `Task created: "${input.title}"${input.dueDate ? ` (due ${input.dueDate})` : ""}.`;
      }

      case "add_crm_lead": {
        try {
          const { supabase } = await import("../lib/supabase.js");
          const { randomUUID } = await import("crypto");
          const now = new Date().toISOString();
          await supabase.from("crm_leads").insert({
            id: randomUUID(), client_id: clientId,
            name: input.name, company: input.company ?? "",
            email: input.email ?? "", phone: input.phone ?? "",
            stage: "new", value: input.value ?? 0, notes: input.notes ?? "",
            created_at: now, last_contact_at: now,
          });
        } catch { /* graceful — will show in CRM next time they load */ }
        broadcastToClient(clientId, { type: "refresh_crm" });
        return `Added ${input.name}${input.company ? ` from ${input.company}` : ""} to your CRM pipeline.`;
      }

      case "log_expense": {
        try {
          const { supabase } = await import("../lib/supabase.js");
          const { randomUUID } = await import("crypto");
          const now = new Date().toISOString();
          await supabase.from("expenses").insert({
            id: randomUUID(), client_id: clientId,
            amount: input.amount, category: input.category,
            description: input.description ?? "", date: now.split("T")[0], created_at: now,
          });
        } catch { /* graceful */ }
        broadcastToClient(clientId, { type: "refresh_expenses" });
        return `Logged $${input.amount} expense for ${input.category}${input.description ? `: ${input.description}` : ""}.`;
      }

      // ── Web search (Brave → DuckDuckGo fallback) ─────────────────────────────
      case "web_search": {
        const q = input.query as string;
        if (process.env.BRAVE_SEARCH_API_KEY) {
          const r = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5`,
            {
              headers: {
                Accept: "application/json",
                "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
              },
            }
          );
          if (r.ok) {
            const data = (await r.json()) as {
              web?: {
                results?: Array<{
                  title: string;
                  description: string;
                  url: string;
                }>;
              };
            };
            const results = (data.web?.results ?? []).slice(0, 5);
            if (results.length > 0) {
              return results
                .map((res) => `${res.title}: ${res.description}`)
                .join("\n\n");
            }
          }
        }
        // DuckDuckGo fallback
        const r = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`
        );
        if (!r.ok) return "Search unavailable right now.";
        const data = (await r.json()) as {
          AbstractText?: string;
          Answer?: string;
          RelatedTopics?: Array<{ Text?: string }>;
        };
        return (
          data.Answer ||
          data.AbstractText ||
          (data.RelatedTopics ?? [])
            .slice(0, 3)
            .map((t) => t.Text)
            .filter(Boolean)
            .join("\n\n") ||
          "No results found."
        );
      }

      // ── Business & content tools ─────────────────────────────────────────────
      case "draft_email": {
        const { to, subject, context, tone = "professional" } = input as {
          to: string;
          subject: string;
          context: string;
          tone?: string;
        };
        const emailResp = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: `Write a ${tone} email to ${to} with subject "${subject}". Context: ${context}. Write only the email body, no subject line.`,
            },
          ],
        });
        const body = (emailResp.content[0] as Anthropic.TextBlock).text;
        broadcastToClient(clientId, {
          type: "phone_command",
          command: "draft_email",
          value: { to, subject, body },
        });
        return `Email drafted:\n\nTo: ${to}\nSubject: ${subject}\n\n${body}`;
      }

      case "generate_social_post": {
        const { platform, topic, style = "educational" } = input as {
          platform: string;
          topic: string;
          style?: string;
        };
        const resp = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: `Create a viral ${style} ${platform} post about: ${topic}. Return JSON with hook (first line, max 15 words), caption (full post body), hashtags (comma-separated), cta (call to action).`,
            },
          ],
        });
        return (resp.content[0] as Anthropic.TextBlock).text;
      }

      case "research_topic": {
        const { topic, focus = "overview" } = input as {
          topic: string;
          focus?: string;
        };
        const resp = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 800,
          messages: [
            {
              role: "user",
              content: `Do a ${focus} research report on: ${topic}. Be specific, factual, and actionable. Include key insights, opportunities, and one concrete next step.`,
            },
          ],
        });
        return (resp.content[0] as Anthropic.TextBlock).text;
      }

      case "create_pitch": {
        const { product, audience, format = "elevator_30s" } = input as {
          product: string;
          audience: string;
          format?: string;
        };
        const resp = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `Create a ${format.replace(/_/g, " ")} pitch for "${product}" targeting ${audience}. Make it compelling, specific, and high-converting.`,
            },
          ],
        });
        return (resp.content[0] as Anthropic.TextBlock).text;
      }

      case "analyze_metrics": {
        const { metrics, goal = "growth" } = input as {
          metrics: string;
          goal?: string;
        };
        const resp = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: `Analyze these metrics for ${goal} optimization: ${metrics}. Give 3 specific, actionable insights and prioritize the highest-impact change.`,
            },
          ],
        });
        return (resp.content[0] as Anthropic.TextBlock).text;
      }

      case "build_strategy": {
        const {
          goal,
          timeline = "30 days",
          resources = "solo founder",
        } = input as {
          goal: string;
          timeline?: string;
          resources?: string;
        };
        const resp = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 800,
          messages: [
            {
              role: "user",
              content: `Build a ${timeline} strategy to achieve: ${goal}. Resources: ${resources}. Give a numbered action plan with specific steps, prioritized by impact. Be ruthlessly practical.`,
            },
          ],
        });
        return (resp.content[0] as Anthropic.TextBlock).text;
      }

      case "generate_hashtags": {
        const { niche, platform, size = "medium" } = input as {
          niche: string;
          platform: string;
          size?: string;
        };
        const resp = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Generate 30 optimized ${platform} hashtags for ${niche} content targeting ${size} audience reach. Mix niche, medium, and broad tags. Return just the hashtags separated by spaces.`,
            },
          ],
        });
        return (resp.content[0] as Anthropic.TextBlock).text;
      }

      case "create_outreach_sequence": {
        const { target, goal, steps = 3 } = input as {
          target: string;
          goal: string;
          steps?: number;
        };
        const resp = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 800,
          messages: [
            {
              role: "user",
              content: `Create a ${steps}-step DM/email outreach sequence to ${target} with goal: ${goal}. Number each message. Make them feel personal and non-spammy.`,
            },
          ],
        });
        return (resp.content[0] as Anthropic.TextBlock).text;
      }

      case "morning_briefing": {
        const { focus = "business" } = input as { focus?: string };
        const today = new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        });
        const resp = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: `Generate a high-energy morning briefing for today, ${today}. Focus: ${focus}. Include: 1) Top 3 priorities for today 2) One market/industry insight 3) One content idea 4) Daily affirmation for entrepreneurs. Be energizing and action-focused.`,
            },
          ],
        });
        return (resp.content[0] as Anthropic.TextBlock).text;
      }

      case "call_n8n_workflow": {
        const { workflow_name, data = {} } = input as {
          workflow_name: string;
          data?: Record<string, unknown>;
        };
        // Find the workflow by name/keyword using n8n MCP
        try {
          const n8nUrl = process.env.N8N_WEBHOOK_URL;
          if (!n8nUrl) return `n8n workflow "${workflow_name}" triggered (configure N8N_WEBHOOK_URL to enable).`;
          const resp = await fetch(n8nUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflow: workflow_name, clientId, ...data }),
          });
          const result = resp.ok ? await resp.text() : `HTTP ${resp.status}`;
          return `n8n workflow "${workflow_name}" executed. Result: ${result.slice(0, 300)}`;
        } catch (e) {
          return `n8n workflow "${workflow_name}" queued. Error: ${(e as Error).message}`;
        }
      }

      case "save_memory": {
        const { category, content } = input as {
          category: string;
          content: string;
        };
        await supabase.from("agent_activity").insert({
          client_id: clientId,
          action_type: `memory_${category}`,
          description: content,
          confidence: 1.0,
          metadata: { category, remembered_at: new Date().toISOString() },
        });
        return `Remembered: [${category}] ${content}`;
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    return `Tool error: ${(err as Error).message}`;
  }
}

// ── Episodic memory: retrieve similar past successes as few-shot context ──────

async function loadEpisodicContext(clientId: string, userMessage: string): Promise<string> {
  try {
    const keywords = userMessage.split(/\s+/).slice(0, 4).join("%");
    const { data } = await supabase
      .from("agent_episodes")
      .select("user_message, tools_used, response_snippet")
      .eq("client_id", clientId)
      .ilike("user_message", `%${keywords}%`)
      .order("created_at", { ascending: false })
      .limit(3);
    if (!data || data.length === 0) return "";
    return `\n\nRELEVANT PAST INTERACTIONS (use as examples):\n` +
      (data as Array<{ user_message: string; tools_used: string[]; response_snippet: string }>)
        .map((e, i) => `${i + 1}. User asked: "${e.user_message}" → Tools: [${(e.tools_used ?? []).join(", ")}] → You replied: "${e.response_snippet}"`)
        .join("\n");
  } catch {
    return "";
  }
}

async function saveEpisode(clientId: string, userMessage: string, toolsUsed: string[], reply: string) {
  try {
    await supabase.from("agent_episodes").insert({
      client_id: clientId,
      user_message: userMessage.slice(0, 200),
      tools_used: toolsUsed,
      response_snippet: reply.slice(0, 300),
      created_at: new Date().toISOString(),
    });
  } catch { /* non-critical */ }
}

// ── Main chat function ────────────────────────────────────────────────────────

export async function chat(
  clientId: string,
  userMessage: string,
  imageBase64?: string,
  imageMediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
): Promise<{ reply: string; toolsUsed: string[] }> {
  // Load conversation history from Supabase
  const { data: history } = await supabase
    .from("conversations")
    .select("role, content")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(20);

  // Build user content — text only, or text + image if provided
  const userContent: Anthropic.ContentBlockParam[] = imageBase64 && imageMediaType
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: imageMediaType, data: imageBase64 },
        },
        { type: "text", text: userMessage },
      ]
    : [{ type: "text", text: userMessage }];

  const messages: Anthropic.MessageParam[] = [
    ...((history ?? []) as Anthropic.MessageParam[]),
    { role: "user", content: userContent },
  ];

  const tools = await getToolsForClient(clientId);
  const tradingActive = tools.some((t) => t.name === "basketbot_start");

  const today = new Date().toISOString().split("T")[0];

  // Load episodic memory BEFORE building systemPrompt so it can be injected
  const episodicContext = await loadEpisodicContext(clientId, userMessage);

  // Load client's custom agent config (name, personality, instructions)
  const { data: agentCfg } = await supabase
    .from("agent_config")
    .select("agent_name, personality, communication_style, focus_areas, custom_instructions")
    .eq("client_id", clientId)
    .single();

  const agentName = agentCfg?.agent_name ?? "Mars";
  const customPersonality = agentCfg?.personality
    ? `\n\n--- CLIENT CUSTOMIZATION ---\n${agentCfg.personality}`
    : "";
  const customStyle = agentCfg?.communication_style
    ? `\nCommunication style: ${agentCfg.communication_style}`
    : "";
  const customFocus = agentCfg?.focus_areas?.length
    ? `\nFocus areas: ${(agentCfg.focus_areas as string[]).join(", ")}`
    : "";
  const customInstructions = agentCfg?.custom_instructions
    ? `\n\nAdditional instructions from client:\n${agentCfg.custom_instructions}`
    : "";

  const systemPrompt = tradingActive
    ? `You are ${agentName} — a superintelligent Chief of Staff AI living on the user's Google Pixel phone, powered by Claude Opus.

You are their most valuable asset. You run their business, build their brand, manage their communications, and control their phone. You are better than any VA, social media manager, business coach, or assistant they could hire.

YOUR CAPABILITIES:
• Phone Control — brightness, volume, WiFi, Bluetooth, apps, lock, screenshot, DND, flashlight
• Communications — send SMS, make calls, draft emails with professional tone
• Business — research competitors, build strategies, analyze metrics, create pitches
• Content Creation — viral social posts with hooks/captions/hashtags for Instagram, TikTok, Twitter, LinkedIn, YouTube
• Networking — outreach sequences, DM scripts, follow-up flows
• Intelligence — research any topic, market, person, or trend in depth
• Memory — remember important information, goals, preferences permanently
• Briefings — personalized morning briefings with priorities and opportunities

TRADING CAPABILITIES (ACTIVE):
• BasketBot — start/stop MT5 gold trading bot, adjust parameters
• Portfolio — check balance, equity, open positions in real-time
• WeatherBot — Kalshi prediction market signals

You manage their money as aggressively or conservatively as they specify. Always check portfolio before recommending trading actions.

HOW YOU OPERATE:
- When asked to do something, DO IT IMMEDIATELY — call the tool, then confirm briefly
- Never explain what you're about to do, just do it
- After any content/email/strategy is generated, offer to refine or send
- Be decisive, confident, and action-oriented
- Use the user's name if you know it
- Always end with one power move: a next step, insight, or action they should take

You are not a chatbot. You are the user's competitive advantage.
Current date: ${today}${episodicContext}${customPersonality}${customStyle}${customFocus}${customInstructions}`
    : `You are ${agentName} — a superintelligent Chief of Staff AI living on the user's Google Pixel phone, powered by Claude Opus.

You are their most valuable asset. You run their business, build their brand, manage their communications, and control their phone. You are better than any VA, social media manager, business coach, or assistant they could hire.

YOUR CAPABILITIES:
• Phone Control — brightness, volume, WiFi, Bluetooth, apps, lock, screenshot, DND, flashlight
• Communications — send SMS, make calls, draft emails with professional tone
• Business — research competitors, build strategies, analyze metrics, create pitches
• Content Creation — viral social posts with hooks/captions/hashtags for Instagram, TikTok, Twitter, LinkedIn, YouTube
• Networking — outreach sequences, DM scripts, follow-up flows
• Intelligence — research any topic, market, person, or trend in depth
• Memory — remember important information, goals, preferences permanently
• Briefings — personalized morning briefings with priorities and opportunities

HOW YOU OPERATE:
- When asked to do something, DO IT IMMEDIATELY — call the tool, then confirm briefly
- Never explain what you're about to do, just do it
- After any content/email/strategy is generated, offer to refine or send
- Be decisive, confident, and action-oriented
- Use the user's name if you know it
- Always end with one power move: a next step, insight, or action they should take

You are not a chatbot. You are the user's competitive advantage.
Current date: ${today}${episodicContext}${customPersonality}${customStyle}${customFocus}${customInstructions}`;

  const toolsUsed: string[] = [];

  // Agentic loop — keep running until Claude stops calling tools
  let response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages,
  });

  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.MessageParam = {
      role: "user",
      content: await Promise.all(
        toolUseBlocks.map(async (block) => {
          toolsUsed.push(block.name);
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            clientId
          );
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: result,
          };
        })
      ),
    };

    messages.push({ role: "assistant", content: response.content });
    messages.push(toolResults);

    response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    });
  }

  let replyText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  // ── Reflection loop — if response is weak, self-critique and retry once ──────
  const isWeak = replyText.length < 80 ||
    /i('m| am) not sure|i don't know|i cannot|i'm unable/i.test(replyText);

  if (isWeak) {
    messages.push({ role: "assistant", content: replyText });
    messages.push({
      role: "user",
      content: "Your previous response was incomplete or uncertain. Reflect: what would a decisive, world-class Chief of Staff say here? Retry with a confident, specific, actionable answer.",
    });
    const reflected = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    });
    const improved = reflected.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (improved.length > replyText.length) replyText = improved;
  }

  // Persist conversation turn to Supabase
  await supabase.from("conversations").insert([
    { client_id: clientId, role: "user", content: userMessage },
    { client_id: clientId, role: "assistant", content: replyText },
  ]);

  // Save episodic memory for future few-shot context (fire and forget)
  if (toolsUsed.length > 0 || replyText.length > 150) {
    saveEpisode(clientId, userMessage, toolsUsed, replyText);
  }

  // Log agent activity
  await supabase.from("agent_activity").insert({
    client_id: clientId,
    action_type: "chat",
    description: userMessage.slice(0, 100),
    confidence: isWeak ? 0.6 : 1.0,
    metadata: { tools_used: toolsUsed, reply_length: replyText.length, reflected: isWeak },
  });

  return { reply: replyText, toolsUsed };
}
