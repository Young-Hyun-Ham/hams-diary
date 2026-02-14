<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { userState } from "$lib/stores/user";
  import { Capacitor } from "@capacitor/core";

  import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signInWithCredential,
    type User,
  } from "firebase/auth";
  import { auth } from "$lib/firebase/client";

  let errorMsg = "";
  let busy = false;

  function waitForUser(): Promise<User> {
    return new Promise((resolve, reject) => {
      const unsub = userState.subscribe((s) => {
        if (!s.loading && s.user) {
          unsub();
          resolve(s.user);
        }
      });

      // 혹시 모를 무한 대기 방지 (10초)
      const t = setTimeout(() => {
        unsub();
        reject(new Error("로그인 상태 확인이 지연되고 있어요. 다시 시도해 주세요."));
      }, 10_000);

      // resolve/reject 시 타이머 정리
      userState.subscribe((s) => {
        if (!s.loading && s.user) clearTimeout(t);
      });
    });
  }

  async function loginGoogle() {
    errorMsg = "";
    busy = true;

    try {
      // Capacitor(네이티브 WebView)는 popup이 막히는 경우가 많음
      // const isCapacitor = browser && !!(window as any)?.Capacitor;
      const isNative = browser && Capacitor.isNativePlatform();
      
      if (isNative) {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')
        // 앱 내부 네이티브 로그인
        const g = await GoogleAuth.signIn();
        const idToken = g.authentication?.idToken;

        if (!idToken) throw new Error("Google idToken을 가져오지 못했어요.");

        const cred = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, cred);

        await waitForUser();
        await goto("/diary", { replaceState: true });
        return;
      }
      
      // 웹은 기존대로 팝업
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await waitForUser();
      await goto("/diary", { replaceState: true });
    } catch (e: any) {
      errorMsg = e?.message ?? "로그인에 실패했어요.";
    } finally {
      busy = false;
    }
  }

  // redirect 로그인 흐름 처리 (Capacitor에서 필요)
  onMount(async () => {
    try {
      const r = await getRedirectResult(auth);
      if (r?.user) {
        // 여기까지 오면 redirect 로그인 자체는 성공
        // 이동은 $: 반응형이 처리
      }
    } catch (e: any) {
      console.error("getRedirectResult failed:", e);
      errorMsg = e?.message ?? "redirect 로그인 결과 처리에 실패했어요.";
    }
  });

  // 이미 로그인 상태면 즉시 /diary 이동 (반응형)
  $: if (browser && !$userState.loading && $userState.user) {
    goto("/diary", { replaceState: true });
  }
</script>

<div class="wrap">
  <div class="card">
    <div class="title">📓 My Diary</div>
    <div class="sub">로그인 후 내 Diary를 안전하게 저장해요</div>

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
