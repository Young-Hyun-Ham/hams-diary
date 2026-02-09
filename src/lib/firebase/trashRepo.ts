// src/lib/firebase/trashRepo.ts
import { db } from "$lib/firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  increment,
  writeBatch,
} from "firebase/firestore";

import { deleteStoragePath } from "$lib/firebase/storageRepo";
import type { UploadedImage } from "$lib/firebase/storageRepo";

// ─────────────────────────────────────────────────────────────
// refs (diaryRepo.ts 스타일로 맞춤)
// ─────────────────────────────────────────────────────────────
function diaryRef(uid: string, diaryId: string) {
  return doc(db, "users", uid, "diaries", diaryId);
}
function dayRef(uid: string, day: string) {
  return doc(db, "users", uid, "diaryDays", day);
}

// ─────────────────────────────────────────────────────────────
// utils
// ─────────────────────────────────────────────────────────────
function extractPathsFromHtml(html: string): string[] {
  if (!html) return [];
  const paths = new Set<string>();

  // data-path="..."
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

  // attachments paths
  for (const it of (d.attachments ?? []) as UploadedImage[]) {
    if (it?.path) paths.add(it.path);
  }

  // contentImages paths (있다면)
  for (const it of (d.contentImages ?? []) as UploadedImage[]) {
    if (it?.path) paths.add(it.path);
  }

  // contentHtml data-path
  for (const p of extractPathsFromHtml(d.contentHtml ?? "")) {
    paths.add(p);
  }

  return [...paths];
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
export type TrashDiary = {
  id: string;
  diaryDate: string;
  title: string;
  updatedAt?: any;
  deletedAt?: any;
  attachments?: UploadedImage[];
};

// 휴지통 목록
export async function listDeletedDiaries(uid: string, take = 100): Promise<TrashDiary[]> {
  const col = collection(db, "users", uid, "diaries");
  const q = query(
    col,
    where("deleted", "==", true),
    orderBy("updatedAt", "desc"),
    limit(take)
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

// ✅ 복원: softDeleteDiary의 반대 로직(트랜잭션 + diaryDays 복원)
export async function restoreDiary(uid: string, diaryId: string) {
  const dRef = diaryRef(uid, diaryId);

  await runTransaction(db, async (tx) => {
    // 1) READ 먼저
    const dSnap = await tx.get(dRef);
    if (!dSnap.exists()) throw new Error("문서를 찾을 수 없어요.");

    const data = dSnap.data() as any;
    if (!data.deleted) return;

    const day: string = data.diaryDate;
    if (!day) throw new Error("diaryDate가 없어서 복원할 수 없어요.");

    const sRef = dayRef(uid, day);

    // 2) WRITE
    tx.update(dRef, {
      deleted: false,
      restoredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // ✅ 핵심: 존재/미존재 상관없이 항상 +1
    // ✅ 스키마도 달력에서 쓰는 형태로 같이 넣어줌(안전)
    tx.set(
      sRef,
      {
        dayId: day,          // (달력에서 기대할 수 있는 키)
        diaryDate: day,      // (달력/필터에서 쓰기 좋음)
        count: increment(1), // 무조건 +1
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(), // merge라 기존 있으면 유지됨
      },
      { merge: true }
    );
  });
}

// ✅ 완전삭제: 문서 hard delete + (본문/첨부) 이미지 Storage 삭제
// 주의: soft delete 단계에서 diaryDays count를 이미 감소시켰으므로
//       여기서는 diaryDays를 다시 건드리지 않는다(중복 감소 방지).
export async function hardDeleteDiaryAndImages(uid: string, diaryId: string) {
  const dRef = diaryRef(uid, diaryId);

  // 1) 문서 읽어서 삭제할 이미지 path 수집
  const snap = await getDoc(dRef);
  if (!snap.exists()) return;

  const d = snap.data() as any;
  const paths = collectAllImagePaths(d);

  // 2) Firestore 문서 hard delete
  const batch = writeBatch(db);
  batch.delete(dRef);
  await batch.commit();

  // 3) Storage 이미지 삭제(실패해도 계속)
  for (const p of paths) {
    try {
      await deleteStoragePath(p);
    } catch {
      // ignore
    }
  }
}
