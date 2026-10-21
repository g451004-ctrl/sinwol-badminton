import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { cleanPass, json, parseRoster, validPass } from "../lib/shared.mts";

// 학생 제출. 반 비밀번호가 맞아야 저장되며, 다른 반 명단은 절대 돌려주지 않는다.
export default async (req: Request) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "잘못된 요청입니다." }, 400);
  }
  const parsed = parseRoster(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const r = parsed.roster;
  const key = `${r.grade}-${r.cls}`;

  const pass = cleanPass(body.pass);
  if (!validPass(pass)) return json({ error: "반 비밀번호는 숫자 4자리로 정해 주세요." }, 400);

  const settings = getStore({ name: "settings", consistency: "strong" });
  const day = (await settings.get(`day/${r.date}`, { type: "json" })) as any;
  if (day?.locked) return json({ error: "이 날짜의 명단 제출이 마감되었습니다. 선생님께 문의하세요." }, 403);

  const saved = await settings.get(`classpass/${key}`);
  if (saved && saved !== pass) return json({ error: "반 비밀번호가 맞지 않습니다. 처음 정한 비밀번호를 넣거나 선생님께 문의하세요." }, 403);
  if (!saved) await settings.set(`classpass/${key}`, pass, { onlyIfNew: true });

  const rosters = getStore({ name: "rosters", consistency: "strong" });
  const rk = `${r.date}/${key}`;
  const prev = await rosters.getMetadata(rk);
  await rosters.setJSON(rk, r);
  return json({ ok: true, replaced: !!prev, firstPass: !saved, teams: r.teams });
};

export const config: Config = {
  path: "/api/submit",
  method: ["POST"],
  rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
