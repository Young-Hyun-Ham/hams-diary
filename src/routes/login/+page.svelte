<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
  import { auth } from "$lib/firebase/client";
  import { userState } from "$lib/stores/user";
  import { get } from "svelte/store";

  let errorMsg = "";
  let busy = false;

  async function loginGoogle() {
    errorMsg = "";
    busy = true;
    try {
      const provider = new GoogleAuthProvider();

      // ✅ Capacitor/모바일 WebView는 popup이 막히는 경우가 있어서 redirect도 대비
      // 데스크톱/웹: popup, 그 외: redirect를 써도 됨
      if (browser) {
        await signInWithPopup(auth, provider);
      } else {
        await signInWithRedirect(auth, provider);
      }

      // 로그인 성공하면 /diary로
      await goto("/diary");
    } catch (e: any) {
      errorMsg = e?.message ?? "로그인에 실패했어요.";
    } finally {
      busy = false;
    }
  }

  // 이미 로그인 상태면 바로 이동
  if (browser) {
    const s = get(userState);
    if (!s.loading && s.user) goto("/diary");
  }
</script>

<div class="wrap">
  <div class="card">
    <div class="title">📓 My Diary</div>
    <div class="sub">로그인 후 내 일기를 안전하게 저장해요</div>

    <button class="btn" on:click={loginGoogle} disabled={busy}>
      {busy ? "로그인 중..." : "Google로 로그인"}
    </button>

    {#if errorMsg}
      <div class="err">{errorMsg}</div>
    {/if}

    <div class="hint">
      * 로그인 화면에서는 헤더가 보이지 않습니다.
    </div>
  </div>
</div>

<style>
  .wrap {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 20px;
    background: var(--bg);
    color: var(--text);
  }
  .card {
    width: min(420px, 100%);
    padding: 20px;
    border-radius: 18px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .title { font-size: 18px; font-weight: 700; }
  .sub { margin-top: 6px; font-size: 13px; opacity: 0.75; }
  .btn {
    margin-top: 16px;
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    border: none;
    background: #4f46e5;
    color: #fff;
    font-weight: 700;
  }
  .btn:disabled { opacity: 0.7; }
  .err { margin-top: 10px; font-size: 12px; color: #ef4444; }
  .hint { margin-top: 14px; font-size: 12px; opacity: 0.6; }
</style>
