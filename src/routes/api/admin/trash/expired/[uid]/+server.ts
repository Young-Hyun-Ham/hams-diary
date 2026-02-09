// src/routes/api/admin/trash/expired/[uid]/+server.ts
import { json } from "@sveltejs/kit";
import { adb, astorage } from "$lib/server/firebaseAdmin";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// const ONE_DAY_MS = 3000; // 테스트용 3초

function extractPathsFromHtml(html: string): string[] {
  if (!html) return [];
  const paths = new Set<string>();
  const re = /data-path\s*=\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const p = (m[1] || "").trim();
    if (p) paths.add(p);
  }
  return [...paths];
}

function collectAllImagePaths(d: any): string[] {
  const paths = new Set<string>();

  for (const it of d.attachments ?? []) if (it?.path) paths.add(it.path);
  for (const it of d.contentImages ?? []) if (it?.path) paths.add(it.path);
  for (const p of extractPathsFromHtml(d.contentHtml ?? "")) paths.add(p);

  return [...paths];
}

async function deleteStoragePaths(paths: string[]) {
  const bucket = astorage.bucket();
  for (const p of paths) {
    try {
      await bucket.file(p).delete({ ignoreNotFound: true });
    } catch {
      // ignore
    }
  }
}

export async function DELETE({ params }) {
  const uid = params.uid;
  const cutoff = new Date(Date.now() - ONE_DAY_MS);

  // users/{uid}/diaries 중 24시간 지난 soft delete만
  const snap = await adb
    .collection(`users/${uid}/diaries`)
    .where("deleted", "==", true)
    .where("deletedAt", "<=", cutoff)
    .limit(500)
    .get();

  let deletedCount = 0;
  let imageCount = 0;

  for (const doc of snap.docs) {
    const d = doc.data() as any;

    // 1) 이미지 삭제
    const paths = collectAllImagePaths(d);
    imageCount += paths.length;
    await deleteStoragePaths(paths);

    // 2) 문서 hard delete (diaryDays는 softDelete에서 이미 감소했으니 여기선 건드리지 않음)
    await doc.ref.delete();
    deletedCount += 1;
  }

  return json({ uid, deletedCount, imageCount });
}
