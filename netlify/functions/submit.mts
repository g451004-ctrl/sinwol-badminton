import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { json, parseRoster } from "../lib/shared.mts";

// 학생 제출 전용. 저장만 하고 어떤 명단도 돌려주지 않는다.
export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "잘못된 요청입니다." }, 400);
  }
  const parsed = parseRoster(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const r = parsed.roster;

  const settings = getStore({ name: "settings", consistency: "strong" });
  const day = (await settings.get(`day/${r.date}`, { type: "json" })) as any;
  if (day?.locked) return json({ error: "이 날짜의 명단 제출이 마감되었습니다. 선생님께 문의하세요." }, 403);

  const rosters = getStore({ name: "rosters", consistency: "strong" });
  const key = `${r.date}/${r.grade}-${r.cls}`;
  const prev = await rosters.getMetadata(key);
  await rosters.setJSON(key, r);
  return json({ ok: true, replaced: !!prev });
};

export const config: Config = { path: "/api/submit", method: ["POST"] };
