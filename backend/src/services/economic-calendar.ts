import { broadcastAll } from "../websocket.js";

export interface EconEvent {
  time: string;
  event: string;
  impact: "high" | "medium" | "low";
  currency: string;
}

// Forexfactory public calendar JSON (community-maintained, no auth required)
const CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

// Currencies we care about (XAU trades on USD, plus GBP for GBPUSD/GBPJPY)
const WATCHED = ["USD", "GBP", "XAU", "JPY", "EUR"];

export async function getUpcomingEvents(): Promise<EconEvent[]> {
  try {
    const res = await fetch(CALENDAR_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const raw = await res.json() as Array<{
      title: string;
      country: string;
      date: string;
      impact: string;
    }>;

    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;

    return raw
      .filter((e) => {
        const t = new Date(e.date).getTime();
        return t > now && t < in24h && WATCHED.includes(e.country.toUpperCase());
      })
      .map((e) => ({
        time: e.date,
        event: e.title,
        impact: (["high", "medium", "low"].includes(e.impact?.toLowerCase())
          ? e.impact.toLowerCase()
          : "low") as EconEvent["impact"],
        currency: e.country.toUpperCase(),
      }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  } catch {
    return [];
  }
}

export async function checkAndAlertCalendar(): Promise<void> {
  const events = await getUpcomingEvents();
  const now = Date.now();
  const in2h = now + 2 * 60 * 60 * 1000;

  const imminent = events.filter(
    (e) => e.impact === "high" && new Date(e.time).getTime() <= in2h
  );

  for (const ev of imminent) {
    const minAway = Math.round((new Date(ev.time).getTime() - now) / 60_000);
    broadcastAll({
      type: "alert",
      message: `High-impact news in ${minAway}min: ${ev.event} (${ev.currency})`,
      level: "warning",
      event: ev,
    });
    console.log(`[calendar] Alert sent: ${ev.event} in ${minAway}min`);
  }
}
