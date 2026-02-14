<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import "./layout.css";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { userState } from "$lib/stores/user";
  import { auth } from "$lib/firebase/client";
  import { signOut } from "firebase/auth";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { Capacitor } from "@capacitor/core";
  import { browser } from "$app/environment";
  
  const WEB_CLIENT_ID = "884083912072-fgimtt8ebl4ck500gth4ca87t9bjrbpu.apps.googleusercontent.com";

  onMount(async () => {
    if (!(browser && Capacitor.isNativePlatform())) return;

    // ✅ 안드로이드 WebView에서 safe-area 값이 0인 경우가 많아서 fallback을 강제로 줌
    const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
    if (platform === "android") {
      // 보통 24px~28px 사이. S24 Ultra면 24px이 무난
      document.documentElement.style.setProperty("--safe-top", "24px");
    }

    // ✅ GoogleAuth initialize (동적 import)
    const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
    GoogleAuth.initialize({
      clientId: WEB_CLIENT_ID,
      scopes: ["profile", "email"],
      grantOfflineAccess: true,
    });

    // ✅ StatusBar overlay 끄기 (기기마다 즉시 반영이 안 되더라도 위 fallback이 커버)
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light }); // 필요하면 Dark로 변경
  });

  const allowList = import.meta.env.VITE_ADMIN_ALLOW_LIST;
  // $: 를 사용하면 $userState.user가 바뀔 때마다 자동으로 실행됩니다.
  $: isAdmin = allowList.includes($userState.user?.email ?? "");

  // 확인용 로그 (값이 바뀔 때마다 찍힘)
  // $: console.log("관리자 여부:", isAdmin, "사용자:", $userState.user?.email);

  async function logout() {
    await signOut(auth);
    await goto("/login");
  }
</script>

<div class="app">
    {#if !$userState.loading && $userState.user}
    <header class="header">
      <h1 class="logo">
        <a href="/">
          📓 My Diary
        </a>
      </h1>
      <div class="actions">
        {#if !$userState.loading && $userState.user}
          <div class="me">
            {#if isAdmin}
              <a href="/admin/trash">관리자</a>
            {:else}
              {$userState.user.displayName ?? "사용자"}
            {/if}
            <!-- 휴지통 버튼 -->
            <a class="trashBtn" href="/trash" title="휴지통" aria-label="휴지통">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="currentColor"
                  d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Zm-1 12h12a2 2 0 0 0 2-2V7H4v12a2 2 0 0 0 2 2Z" />
              </svg>
            </a>
          </div>
        {/if}
        <ThemeToggle />

        <button class="btn-ghost" on:click={logout} type="button">
          로그아웃
        </button>
      </div>
    </header>
  {/if}

  <main class="content">
    <slot />
  </main>
</div>

<style>
  /* ✅ 상태바/노치 영역 보정 (Android/iOS 대응) */
  :global(:root) {
    --safe-top: env(safe-area-inset-top, 0px);
  }

  .actions { display:flex; align-items:center; gap:10px; }

  .btn-ghost{
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    font-size: 13px;
    cursor: pointer;
  }

  .me { display:flex; align-items:center; gap:8px; font-size:12px; opacity:0.8; }

  .trashBtn{
    width: 32px; height: 32px;
    display:grid; place-items:center;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    text-decoration: none;
    opacity: 0.9;
  }
  .trashBtn:hover { background: var(--panel2); }

  .app {
    min-height: 100dvh;
    background: var(--bg);
    color: var(--text);
  }

  /* ✅ 헤더: safe-top만큼 위 여백 확보 + 높이 보정 */
  .header {
    position: sticky;
    top: 0;
    z-index: 10;

    /* 기존 56px 헤더에 safe-top을 더해 겹침 방지 */
    height: calc(56px + var(--safe-top));
    padding: 0 16px;
    padding-top: var(--safe-top);

    display: flex;
    align-items: center;
    justify-content: space-between;

    backdrop-filter: blur(8px);
    background: var(--panel);
    border-bottom: 1px solid var(--border);
  }

  .logo {
    font-size: 16px;
    font-weight: 600;
  }

  .content {
    padding: 16px;
    max-width: 720px;
    margin: 0 auto;
  }
</style>
