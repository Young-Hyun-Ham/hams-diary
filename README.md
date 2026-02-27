# H.D.P. (Hams Diary Project)

---

## firebase-admin-key 넣는 방법
 - mac / Linux:
 ```bash
  base64 -i service-account.json
 ```
 - PowerShell:
 ```bash
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("./service-account.json"))
 ```
: 출력된 내용 복사 해서 .env에 넣고, firebaseAdmin.ts 아래와 같이 사용. 
```ts
// 1. Base64 문자열을 Buffer로 바꾼 뒤 UTF-8 문자열로 변환
const decodedJson = Buffer.from(FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf-8');

// 2. JSON 파싱
const raw = JSON.parse(decodedJson);
```

---

# 수정내용 안드로이드에 빌드
- pnpm run build 
- pnpm exec cap sync android
- pnpm exec cap open android
# apk 만들기
- android studio open 한 후 상단메뉴 build > Generate App Bundles or APKs > Generate APKs
- project root > /android/app/build/outputs/apk/debug 위치에 apk 파일 생성 됨.
- 해당 apk 핸드폰으로 이동하여 설치
