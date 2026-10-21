import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { isDate, json } from "../lib/shared.mts";

// 교사 전용. 모든 요청에 x-admin-pass 헤더가 맞아야 한다.
export default async (req: Request) => {
  const expected = Netlify.env.get("ADMIN_PASSWORD");
  if (!expected) return json({ error: "서버에 관리자 비밀번호가 설정되지 않았습니다." }, 500);
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  if (String(body?.pass ?? "") !== expected) return json({ error: "비밀번호가 틀렸습니다." }, 401);
  const { action, date } = body;
  const rosters = getStore({ name: "rosters", consistency: "strong" });
  const settings = getStore({ name: "settings", consistency: "strong" });

  if (action === "dates") {
    const { directories } = await rosters.list({ directories: true });
    return json({ dates: directories.sort().reverse() });
  }

  if (!isDate(date)) return json({ error: "날짜가 올바르지 않습니다." }, 400);

  if (action === "load") {
    const { blobs } = await rosters.list({ prefix: `${date}/` });
    const list = await Promise.all(blobs.map((b) => rosters.get(b.key, { type: "json" })));
    const day = ((await settings.get(`day/${date}`, { type: "json" })) as any) ?? {};
    const passes: Record<string, string> = {};
    const { blobs: pb } = await settings.list({ prefix: "classpass/" });
    await Promise.all(pb.map(async (b) => (passes[b.key.slice(10)] = (await settings.get(b.key)) ?? "")));
    return json({
      passes,
      rosters: list.filter(Boolean),
      matchups: Array.isArray(day.matchups) ? day.matchups : [],
      locked: !!day.locked,
    });
  }

  if (action === "saveDay") {
    const day = ((await settings.get(`day/${date}`, { type: "json" })) as any) ?? {};
    if (Array.isArray(body.matchups)) {
      day.matchups = body.matchups.slice(0, 30).map((m: any) => ({
        a: String(m?.a ?? "").slice(0, 8),
        b: String(m?.b ?? "").slice(0, 8),
        court: String(m?.court ?? "").slice(0, 20),
      }));
    }
    if (typeof body.locked === "boolean") day.locked = body.locked;
    await settings.setJSON(`day/${date}`, day);
    return json({ ok: true, day });
  }

  if (action === "resetPass") {
    const k = String(body.classKey ?? "");
    if (!/^\d-\d{1,2}$/.test(k)) return json({ error: "잘못된 반" }, 400);
    await settings.delete(`classpass/${k}`);
    return json({ ok: true });
  }

  if (action === "delete") {
    const k = String(body.classKey ?? "");
    if (!/^\d-\d{1,2}$/.test(k)) return json({ error: "잘못된 반" }, 400);
    await rosters.delete(`${date}/${k}`);
    return json({ ok: true });
  }

  return json({ error: "알 수 없는 요청" }, 400);
};

export const config: Config = { path: "/api/admin", method: ["POST"] };
