// src/routes/api/admin/trash/expired/+server.ts
import { json, error } from "@sveltejs/kit";
import { adb } from "$lib/server/firebaseAdmin";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// const ONE_DAY_MS = 3000; // test용 3초

function getUidFromDiaryPath(path: string) {
  // users/{uid}/diaries/{diaryId}
  const m = path.match(/^users\/([^/]+)\/diaries\/[^/]+$/);
  return m?.[1] ?? null;
}

export async function GET() {
  const cutoff = new Date(Date.now() - ONE_DAY_MS);

  // ✅ collectionGroup으로 전체 유저의 diaries 중 조건 맞는 것만
  const snap = await adb
    .collectionGroup("diaries")
    .where("deleted", "==", true)
    .where("deletedAt", "<=", cutoff)
    .limit(2000)
    .get();

  const countByUid = new Map<string, number>();

  for (const doc of snap.docs) {
    const uid = getUidFromDiaryPath(doc.ref.path);
    if (!uid) continue;
    countByUid.set(uid, (countByUid.get(uid) ?? 0) + 1);
  }

  // 유저 정보(users/{uid})도 같이 가져오기(이름/이메일)
  const uids = [...countByUid.keys()];
  const userDocs = await Promise.all(
    uids.map((uid) => adb.doc(`users/${uid}`).get().catch(() => null))
  );

  const users = uids.map((uid, i) => {
    const ud = userDocs[i];
    const u = ud?.exists ? (ud.data() as any) : {};
    return {
      uid,
      name: u?.displayName ?? u?.name ?? "사용자",
      email: u?.email ?? "",
      count: countByUid.get(uid) ?? 0,
    };
  });

  users.sort((a, b) => b.count - a.count);

  return json({
    cutoff: cutoff.toISOString(),
    users,
  });
}
