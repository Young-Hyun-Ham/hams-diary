<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import "./layout.css";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { userState } from "$lib/stores/user";
  import { auth } from "$lib/firebase/client";
  import { signOut } from "firebase/auth";
  import { goto } from "$app/navigation";

  const allowList = ["hyh8414@gmail.com"];
  // $: 를 사용하면 $userState.user가 바뀔 때마다 자동으로 실행됩니다.
  $: isAdmin = allowList.includes($userState.user?.email ?? "");

  // 확인용 로그 (값이 바뀔 때마다 찍힘)
  $: console.log("관리자 여부:", isAdmin, "사용자:", $userState.user?.email);

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
            <!-- ✅ 휴지통 버튼 -->
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

  .header {
    position: sticky;
    top: 0;
    z-index: 10;
    height: 56px;
    padding: 0 16px;
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
