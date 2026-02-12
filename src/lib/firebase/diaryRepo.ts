// src/lib/firebase/diaryRepo.ts
import { db } from "$lib/firebase/client";
import {
  doc,
  collection,
  serverTimestamp,
  runTransaction,
  increment,
} from "firebase/firestore";
import type { UploadedImage } from "$lib/firebase/storageRepo";

export type DiaryInput = {
  diaryDate: string; // "YYYY-MM-DD"
  title: string;
  contentHtml: string;
  contentText: string;
  mood?: string;
  tags?: string[];
  favorite?: boolean;

  // timeline
  showOnTimeline?: boolean;
  timelineTitle?: string;
  timelineSummary?: string;
  timelineDate?: string;

  contentImages?: UploadedImage[]; // 본문에 삽입된 이미지
  attachments?: UploadedImage[];   // 하단 첨부 이미지(리스트로만 보여줄 것)
};

export type DiaryUpdateInput = Partial<DiaryInput> & {
  diaryDate?: string; // 날짜 변경 가능
};

function dayRef(uid: string, ymd: string) {
  return doc(db, "users", uid, "diaryDays", ymd);
}

function diaryRef(uid: string, diaryId: string) {
  return doc(db, "users", uid, "diaries", diaryId);
}

function diariesCol(uid: string) {
  return collection(db, "users", uid, "diaries");
}

/**
 * 일기 추가 (read → write 순서 준수)
 */
export async function addDiary(
  uid: string,
  input: any,
  diaryId: string,
  authorName?: string
) {
  const id = diaryId ?? doc(diariesCol(uid)).id;
  const dRef = diaryRef(uid, id);
  const day = input.diaryDate;
  const sRef = dayRef(uid, day);
  const name = (authorName || "").trim() || "사용자";

  await runTransaction(db, async (tx) => {
    // 1) READ 먼저
    const sSnap = await tx.get(sRef);

    // 2) WRITE
    tx.set(dRef, {
      uid,
      diaryDate: input.diaryDate,
      title: input.title ?? "",
      
      contentHtml: input.contentHtml ?? "",
      contentText: input.contentText ?? "",

      mood: input.mood ?? null,
      tags: input.tags ?? [],
      favorite: input.favorite ?? false,

      showOnTimeline: input.showOnTimeline ?? true,
      timelineTitle: input.timelineTitle ?? "",
      timelineSummary: input.timelineSummary ?? "",
      timelineDate: input.timelineDate ?? input.diaryDate,

      contentImages: input.contentImages ?? [],
      attachments: input.attachments ?? [],
      
      authorName: name,
      deleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (!sSnap.exists()) {
      tx.set(sRef, {
        date: day,
        count: 1,
        hasFavorite: !!input.favorite,
        lastEntryAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.update(sRef, {
        count: increment(1),
        ...(input.favorite ? { hasFavorite: true } : {}),
        lastEntryAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });

  return id;
}

/**
 * 일기 수정 (날짜 변경 포함) (read → write 순서 준수)
 */
export async function updateDiary(uid: string, diaryId: string, patch: DiaryUpdateInput) {
  const dRef = diaryRef(uid, diaryId);

  await runTransaction(db, async (tx) => {
    // 1) READ 먼저
    const dSnap = await tx.get(dRef);
    if (!dSnap.exists()) throw new Error("Diary not found");

    const prev = dSnap.data() as any;
    if (prev.deleted) throw new Error("Diary is deleted");

    const prevDay: string = prev.diaryDate;
    const nextDay: string = patch.diaryDate ?? prevDay;

    // 날짜가 바뀌는 경우 필요한 summary 문서들도 READ
    const prevRef = dayRef(uid, prevDay);
    const nextRef = dayRef(uid, nextDay);

    const prevSnap = await tx.get(prevRef);
    const nextSnap = nextDay !== prevDay ? await tx.get(nextRef) : null;

    // 2) WRITE
    // 2-1) diary 업데이트
    tx.update(dRef, {
      ...("title" in patch ? { title: patch.title ?? "" } : {}),
      ...("contentHtml" in patch ? { contentHtml: patch.contentHtml ?? "" } : {}),
      ...("contentText" in patch ? { contentText: patch.contentText ?? "" } : {}),

      ...("contentImages" in patch ? { contentImages: patch.contentImages ?? [] } : {}),
      ...("attachments" in patch ? { attachments: patch.attachments ?? [] } : {}),

      ...("favorite" in patch ? { favorite: !!patch.favorite } : {}),
      // 타임라인 patch 반영
      ...("showOnTimeline" in patch ? { showOnTimeline: patch.showOnTimeline ?? true } : {}),
      ...("timelineTitle" in patch ? { timelineTitle: patch.timelineTitle ?? "" } : {}),
      ...("timelineSummary" in patch ? { timelineSummary: patch.timelineSummary ?? "" } : {}),
      ...("timelineDate" in patch ? { timelineDate: patch.timelineDate ?? patch.diaryDate ?? prev.diaryDate } : {}),

      ...(nextDay !== prevDay ? { diaryDate: nextDay } : {}),
      updatedAt: serverTimestamp(),
    });

    // 2-2) summary 처리
    if (nextDay !== prevDay) {
      // prevDay count -1
      if (prevSnap.exists()) {
        const prevCount = (prevSnap.data() as any).count ?? 0;
        if (prevCount <= 1) tx.delete(prevRef);
        else tx.update(prevRef, { count: increment(-1), updatedAt: serverTimestamp() });
      }

      // nextDay count +1
      const effectiveFav = patch.favorite ?? prev.favorite;
      if (!nextSnap || !nextSnap.exists()) {
        tx.set(nextRef, {
          date: nextDay,
          count: 1,
          hasFavorite: !!effectiveFav,
          lastEntryAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(nextRef, {
          count: increment(1),
          ...(effectiveFav ? { hasFavorite: true } : {}),
          lastEntryAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      // 날짜 그대로: lastEntryAt 갱신(없으면 복구 생성)
      if (prevSnap.exists()) {
        tx.update(prevRef, {
          ...(patch.favorite ? { hasFavorite: true } : {}),
          lastEntryAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const effectiveFav = patch.favorite ?? prev.favorite;
        tx.set(prevRef, {
          date: prevDay,
          count: 1,
          hasFavorite: !!effectiveFav,
          lastEntryAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  });
}

/**
 * 일기 삭제 (hard delete) (read → write 순서 준수)
 */
export async function deleteDiary(uid: string, diaryId: string) {
  const dRef = diaryRef(uid, diaryId);

  await runTransaction(db, async (tx) => {
    // 1) READ 먼저
    const dSnap = await tx.get(dRef);
    if (!dSnap.exists()) return;

    const data = dSnap.data() as any;
    const day: string = data.diaryDate;
    const sRef = dayRef(uid, day);
    const sSnap = await tx.get(sRef);

    // 2) WRITE
    tx.delete(dRef);

    if (sSnap.exists()) {
      const count = (sSnap.data() as any).count ?? 0;
      if (count <= 1) tx.delete(sRef);
      else tx.update(sRef, { count: increment(-1), updatedAt: serverTimestamp() });
    }
  });
}

/**
 * 소프트 삭제 (deleted=true) (read → write 순서 준수)
 */
export async function softDeleteDiary(uid: string, diaryId: string) {
  const dRef = diaryRef(uid, diaryId);

  await runTransaction(db, async (tx) => {
    // 1) READ 먼저
    const dSnap = await tx.get(dRef);
    if (!dSnap.exists()) return;

    const data = dSnap.data() as any;
    if (data.deleted) return;

    const day: string = data.diaryDate;
    const sRef = dayRef(uid, day);
    const sSnap = await tx.get(sRef);

    // 2) WRITE
    tx.update(dRef, { deleted: true, updatedAt: serverTimestamp(), deletedAt: serverTimestamp() });

    if (sSnap.exists()) {
      const count = (sSnap.data() as any).count ?? 0;
      if (count <= 1) tx.delete(sRef);
      else tx.update(sRef, { count: increment(-1), updatedAt: serverTimestamp() });
    }
  });
}
