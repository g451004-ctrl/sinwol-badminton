import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { classKeyOf, cleanPass, isDate, json } from "../lib/shared.mts";

// 반 비밀번호가 맞으면 그 반의 명단만 돌려준다 (선택한 날짜 것, 없으면 가장 최근 것).
export default async (req: Request) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "잘못된 요청입니다." }, 400);
  }
  const key = classKeyOf(body);
  if (!key) return json({ error: "학년과 반을 선택해 주세요." }, 400);
  const pass = cleanPass(body.pass);

  const settings = getStore({ name: "settings", consistency: "strong" });
  const saved = await settings.get(`classpass/${key}`);
  if (!saved) return json({ error: "아직 이 반이 제출한 명단이 없습니다. 처음 제출할 때 비밀번호가 정해집니다." }, 404);
  if (saved !== pass) return json({ error: "반 비밀번호가 맞지 않습니다." }, 403);

  const rosters = getStore({ name: "rosters", consistency: "strong" });
  if (isDate(body.date)) {
    const same = await rosters.get(`${body.date}/${key}`, { type: "json" });
    if (same) return json({ roster: same, sameDate: true });
  }
  const { blobs } = await rosters.list();
  const mine = blobs.map((b) => b.key).filter((k) => k.endsWith(`/${key}`)).sort();
  if (!mine.length) return json({ error: "저장된 명단이 없습니다." }, 404);
  const latest = await rosters.get(mine[mine.length - 1], { type: "json" });
  return json({ roster: latest, sameDate: false });
};

export const config: Config = {
  path: "/api/load",
  method: ["POST"],
  rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
