// 공용 상수와 검증 함수
export const TEAM_KEYS = ["w1", "w2", "w3", "x1", "x2", "x3", "m1", "m2", "m3"] as const;

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);

// 반 번호(1~2자리)만 쓰면 학년+반+번호 5자리 학번으로 바꾼다. 예: 2학년 7반 17번 → 20717
export const fullSid = (sid: string, grade: number, cls: number) =>
  /^\d{1,2}$/.test(sid) ? `${grade}${String(cls).padStart(2, "0")}${sid.padStart(2, "0")}` : sid;

export const classKeyOf = (body: any) => {
  const g = Number(body?.grade), c = Number(body?.cls);
  return Number.isInteger(g) && g >= 1 && g <= 3 && Number.isInteger(c) && c >= 1 && c <= 20 ? `${g}-${c}` : null;
};

export const cleanPass = (v: unknown) => String(v ?? "").trim();
export const validPass = (p: string) => /^\d{4}$/.test(p);

export type Player ={ sid: string; name: string };
export type Roster = {
  date: string;
  grade: number;
  cls: number;
  submitter: string;
  teams: Record<string, Player[]>;
  submittedAt: string;
};

export function parseRoster(body: any): { ok: true; roster: Roster } | { ok: false; error: string } {
  if (!isDate(body?.date)) return { ok: false, error: "날짜가 올바르지 않습니다." };
  const grade = Number(body?.grade);
  const cls = Number(body?.cls);
  if (!Number.isInteger(grade) || grade < 1 || grade > 3) return { ok: false, error: "학년을 선택해 주세요." };
  if (!Number.isInteger(cls) || cls < 1 || cls > 20) return { ok: false, error: "반을 선택해 주세요." };
  const submitter = clean(body?.submitter, 20);
  if (!submitter) return { ok: false, error: "제출자 이름을 입력해 주세요." };

  const teams: Record<string, Player[]> = {};
  let filled = 0;
  for (const k of TEAM_KEYS) {
    const raw = Array.isArray(body?.teams?.[k]) ? body.teams[k] : [];
    const players = [0, 1].map((i) => ({ sid: clean(raw[i]?.sid, 10), name: clean(raw[i]?.name, 20) }));
    const any = players.some((p) => p.sid || p.name);
    const all = players.every((p) => p.sid && p.name);
    if (any && !all) return { ok: false, error: `${k} 팀의 학번과 이름을 모두 입력해 주세요.` };
    for (const p of players) {
      if (p.sid && !/^\d{1,6}$/.test(p.sid)) return { ok: false, error: `학번은 숫자로 입력해 주세요: ${p.sid}` };
      p.sid = fullSid(p.sid, grade, cls);
    }
    teams[k] = all ? players : [];
    if (all) filled++;
  }
  if (filled === 0) return { ok: false, error: "최소 한 팀은 입력해 주세요." };

  return { ok: true, roster: { date: body.date, grade, cls, submitter, teams, submittedAt: new Date().toISOString() } };
}
