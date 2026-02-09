// src/liib/firebase/diaryDetailRepo.ts
import { db } from "$lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";

export async function getDiary(uid: string, diaryId: string) {
  const ref = doc(db, "users", uid, "diaries", diaryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Diary not found");
  return { id: snap.id, ...(snap.data() as any) };
}
