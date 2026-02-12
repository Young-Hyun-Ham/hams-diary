// src/lib/firebase/userRepo.ts
import { db } from "$lib/firebase/client";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";

export async function ensureUserDoc(u: User) {
  const ref = doc(db, "users", u.uid);

  const displayName =
    (u.displayName ?? "").trim() ||
    (u.email ? u.email.split("@")[0] : "") ||
    "사용자";

  await setDoc(
    ref,
    {
      uid: u.uid,
      email: u.email ?? "",
      displayName,
      photoURL: u.photoURL ?? "",
      providerId: u.providerData?.[0]?.providerId ?? "",
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // 최초 생성 시에만 들어가도록 merge로 처리
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}
