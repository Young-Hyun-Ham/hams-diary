// src/lib/server/firebaseAdmin.ts
import { FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 } from '$env/static/private';
import { PUBLIC_FIREBASE_STORAGE_BUCKET } from '$env/static/public';
import admin from "firebase-admin";

function init() {
  if (admin.apps.length) return admin.app();
  
  // Base64 문자열을 Buffer로 바꾼 뒤 UTF-8 문자열로 변환
  const raw = Buffer.from(FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf-8');

  if (raw) {
    const cred = admin.credential.cert(JSON.parse(raw));
    return admin.initializeApp({
      credential: cred,
      storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  // 2) GOOGLE_APPLICATION_CREDENTIALS: 파일 경로 방식
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const app = init();
export const adb = admin.firestore();
export const astorage = admin.storage();
export const authAdmin = admin.auth();
