// src/lib/api.ts
import { Capacitor } from "@capacitor/core";
import { browser } from "$app/environment";

const PROD_ORIGIN = "https://hams-diary.vercel.app"; // 네가 원하는 고정 도메인

export function apiUrl(path: string) {
  // path: "/api/..." 형태로 들어온다고 가정
  // if (!browser) return path;
  if (Capacitor.isNativePlatform()) return `${PROD_ORIGIN}${path}`;
  return path; // 웹에서는 상대경로 그대로
}
