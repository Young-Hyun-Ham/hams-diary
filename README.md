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