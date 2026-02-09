// src/lib/firebase/storageRepo.ts
import { storage } from "$lib/firebase/client";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

export type UploadedImage = {
  url: string;
  path: string;
  name?: string;
  size?: number;
  contentType?: string;
};

function safeName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_");
}

export async function uploadDiaryImage(uid: string, diaryId: string, file: File) {
  const ts = Date.now();
  const path = `users/${uid}/diaries/${diaryId}/images/${ts}_${safeName(file.name)}`;
  const r = ref(storage, path);

  await uploadBytes(r, file, { contentType: file.type });

  const url = await getDownloadURL(r);
  const out: UploadedImage = {
    url,
    path,
    name: file.name,
    size: file.size,
    contentType: file.type,
  };
  return out;
}

export async function deleteStoragePath(path: string) {
  if (!path) return;
  const r = ref(storage, path);
  await deleteObject(r);
}