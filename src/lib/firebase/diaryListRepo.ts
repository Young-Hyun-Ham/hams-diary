// src/lib/firebase/diaryListRepo.ts
import { db } from "$lib/firebase/client";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export type DiaryListItem = {
  id: string;
  diaryDate: string;
  title: string;
  content: string;
  favorite?: boolean;
  createdAt?: any;
  updatedAt?: any;
  
  // 타임라인
  showOnTimeline?: boolean;
  timelineTitle?: string;
  timelineSummary?: string;
  timelineDate?: string;
};

// 공통: diaries 컬렉션
function diariesCol(uid: string) {
  return collection(db, "users", uid, "diaries");
}

function toItem(docSnap: any): DiaryListItem {
  const v = docSnap.data() as any;
  return {
    id: docSnap.id,
    diaryDate: v.diaryDate,
    title: v.title ?? "",
    // 프로젝트의 실제 저장 필드: contentText
    content: v.contentText ?? "",
    favorite: !!v.favorite,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    // 타임라인
    showOnTimeline: v.showOnTimeline ?? true,
    timelineTitle: v.timelineTitle ?? "",
    timelineSummary: v.timelineSummary ?? "",
    timelineDate: v.timelineDate ?? v.diaryDate,
  };
}

/**
 * 전체 목록 (최신순)
 * - diaryDate desc, updatedAt desc (보조)
 */
export async function listDiaries(uid: string, pageSize = 20, cursor?: QueryDocumentSnapshot) {
  const q = cursor
    ? query(
        diariesCol(uid),
        where("deleted", "==", false),
        orderBy("diaryDate", "desc"),
        orderBy("updatedAt", "desc"),
        startAfter(cursor),
        limit(pageSize)
      )
    : query(
        diariesCol(uid),
        where("deleted", "==", false),
        orderBy("diaryDate", "desc"),
        orderBy("updatedAt", "desc"),
        limit(pageSize)
      );

  const snap = await getDocs(q);
  const items = snap.docs.map(toItem);
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : undefined;
  return { items, nextCursor };
}

/**
 * 타임라인 전용 목록
 * - deleted == false
 * - showOnTimeline == true
 * - timelineDate desc, updatedAt desc
 */
export async function listTimelineDiaries(
  uid: string,
  pageSize = 20,
  cursor?: QueryDocumentSnapshot
) {
  const q = cursor
    ? query(
        diariesCol(uid),
        where("deleted", "==", false),
        where("showOnTimeline", "==", true),
        orderBy("timelineDate", "desc"),
        orderBy("updatedAt", "desc"),
        startAfter(cursor),
        limit(pageSize)
      )
    : query(
        diariesCol(uid),
        where("deleted", "==", false),
        where("showOnTimeline", "==", true),
        orderBy("timelineDate", "desc"),
        orderBy("updatedAt", "desc"),
        limit(pageSize)
      );

  const snap = await getDocs(q);
  const items = snap.docs.map(toItem);
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : undefined;
  return { items, nextCursor };
}

/**
 * 즐겨찾기 목록 (최신순)
 * - favorite == true
 * - deleted == false
 * - diaryDate desc, updatedAt desc
 */
export async function listFavoriteDiaries(
  uid: string,
  pageSize = 20,
  cursor?: QueryDocumentSnapshot
) {
  const q = cursor
    ? query(
        diariesCol(uid),
        where("deleted", "==", false),
        where("favorite", "==", true),
        orderBy("diaryDate", "desc"),
        orderBy("updatedAt", "desc"),
        startAfter(cursor),
        limit(pageSize)
      )
    : query(
        diariesCol(uid),
        where("deleted", "==", false),
        where("favorite", "==", true),
        orderBy("diaryDate", "desc"),
        orderBy("updatedAt", "desc"),
        limit(pageSize)
      );

  const snap = await getDocs(q);
  const items = snap.docs.map(toItem);
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : undefined;
  return { items, nextCursor };
}

/**
 * 특정 날짜 목록 (해당 날짜 최신순)
 * - diaryDate == ymd, updatedAt desc
 */
export async function listDiariesByDate(uid: string, ymd: string, pageSize = 50) {
  const q = query(
    diariesCol(uid),
    where("deleted", "==", false),
    where("diaryDate", "==", ymd),
    orderBy("updatedAt", "desc"),
    limit(pageSize)
  );

  const snap = await getDocs(q);
  const items = snap.docs.map(toItem);
  return { items };
}
