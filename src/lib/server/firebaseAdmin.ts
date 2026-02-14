// src/lib/server/firebaseAdmin.ts
import { env } from "$env/dynamic/private";
import { PUBLIC_FIREBASE_STORAGE_BUCKET } from "$env/static/public";
import admin from "firebase-admin";

function requireEnv(name: string, v?: string) {
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v;
}

function init() {
  if (admin.apps.length) return admin.app();

  const b64 = env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  // Vercel에서는 applicationDefault()에 기대지 말고, 서비스계정이 없으면 서버기능을 막는게 안전
  const raw = Buffer.from(requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64", b64), "base64").toString("utf-8");

  const cred = admin.credential.cert(JSON.parse(raw));
  return admin.initializeApp({
    credential: cred,
    storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const app = init();
export const adb = admin.firestore();
export const astorage = admin.storage();
export const authAdmin = admin.auth();
