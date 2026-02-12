// src/lib/firebase/diaryCalendarRepo.ts
import { db } from "$lib/firebase/client";
import { monthRange } from "$lib/utils/date";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

export type DiaryDaySummary = {
  id: string;        // "YYYY-MM-DD"
  date: string;      // "YYYY-MM-DD"
  count: number;
  hasFavorite?: boolean;
  lastEntryAt?: any;
  updatedAt?: any;
};

/**
 * 달력용: 특정 월(YYYY-MM)의 diaryDays를 한 번에 조회
 * - users/{uid}/diaryDays
 * - date >= start AND date < end
 */
export async function getDiaryDaysByMonth(uid: string, ym: string) {
  const { start, end } = monthRange(ym);

  const col = collection(db, "users", uid, "diaryDays");
  const q = query(
    col,
    where("date", ">=", start),
    where("date", "<", end),
    orderBy("date", "asc")
  );

  const snap = await getDocs(q);

  const days: DiaryDaySummary[] = [];
  snap.forEach((d) => {
    const v = d.data() as any;
    days.push({
      id: d.id,
      date: v.date ?? d.id,
      count: v.count ?? 0,
      hasFavorite: !!v.hasFavorite,
      lastEntryAt: v.lastEntryAt,
      updatedAt: v.updatedAt,
    });
  });

  // 달력에서 빠르게 찾도록 map도 같이 만들면 편함
  const map = new Map<string, DiaryDaySummary>();
  for (const it of days) map.set(it.date, it);

  return { days, map, start, end };
}
