// src/lib/stores/user.ts
import { browser } from "$app/environment";
import { writable } from "svelte/store";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "$lib/firebase/client";
import { ensureUserDoc } from "$lib/firebase/userRepo";

type UserState = { user: User | null; loading: boolean };
export const userState = writable<UserState>({ user: null, loading: true });

if (browser) {
  onAuthStateChanged(auth, async (u) => {
    if (u) {
      try {
        await ensureUserDoc(u);
      } catch (e) {
        console.error("ensureUserDoc failed:", e);
      }
    }
    userState.set({ user: u, loading: false });
  });
}


