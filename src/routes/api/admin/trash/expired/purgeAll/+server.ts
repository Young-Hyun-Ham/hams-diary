// src/routes/api/admin/trash/expired/purgeAll/+server.ts
import { json } from "@sveltejs/kit";

export async function POST() {
  // 프론트에서 users 목록을 받아와서 uid별 DELETE를 순차 호출하는 방식이 더 안전/단순.
  // 여기서는 “엔드포인트 존재만” 두고, 실제 전체삭제는 페이지에서 순차 처리로 구현하자.
  return json({ ok: true });
}
