// src/routes/api/admin/trash/expired/purgeAll/+server.ts
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

type UserItem = { uid: string; count?: number };

export const POST: RequestHandler = async ({ request, fetch }) => {
  const origin = request.headers.get("origin");

  let body: any;
  try {
    body = await request.json();
  } catch {
    throw error(400, "body must be JSON");
  }

  const users: UserItem[] = Array.isArray(body?.users) ? body.users : [];
  if (!users.length) {
    return json(
      { ok: true, total: 0, done: 0, results: [] },
    );
  }

  // count>0 인 uid만
  const targets = users
    .filter((u) => u?.uid && (u.count ?? 0) > 0)
    .map((u) => ({ uid: String(u.uid), count: Number(u.count ?? 0) }));

  const results: Array<{
    uid: string;
    ok: boolean;
    status: number;
    deletedCount?: number;
    imageCount?: number;
    error?: string;
  }> = [];

  for (const t of targets) {
    try {
      // 같은 SvelteKit 앱 내부의 DELETE 엔드포인트 호출
      const r = await fetch(`/api/admin/trash/expired/${encodeURIComponent(t.uid)}`, {
        method: "DELETE",
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        results.push({
          uid: t.uid,
          ok: false,
          status: r.status,
          error: txt || `DELETE failed (${r.status})`,
        });
        continue;
      }

      const j = (await r.json().catch(() => null)) as any;
      results.push({
        uid: t.uid,
        ok: true,
        status: r.status,
        deletedCount: Number(j?.deletedCount ?? 0),
        imageCount: Number(j?.imageCount ?? 0),
      });
    } catch (e: any) {
      results.push({
        uid: t.uid,
        ok: false,
        status: 0,
        error: e?.message ?? "fetch failed",
      });
    }
  }

  const done = results.filter((x) => x.ok).length;

  return json(
    {
      ok: true,
      total: targets.length,
      done,
      results,
    },
  );
};
