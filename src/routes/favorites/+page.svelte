<!-- src/routes/favorites/+page.svelte -->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { userState } from "$lib/stores/user";
  import { listFavoriteDiaries, type DiaryListItem } from "$lib/firebase/diaryListRepo";
  import { updateDiary } from "$lib/firebase/diaryRepo";
  import type { QueryDocumentSnapshot } from "firebase/firestore";

  let loading = true;
  let errorMsg = "";
  let items: DiaryListItem[] = [];
  let cursor: QueryDocumentSnapshot | undefined;
  let moreLoading = false;

  async function loadFirst() {
    const uid = $userState.user?.uid;
    if (!uid) return;

    loading = true;
    errorMsg = "";
    try {
      const r = await listFavoriteDiaries(uid, 20);
      items = r.items;
      cursor = r.nextCursor;
    } catch (e: any) {
      errorMsg = e?.message ?? "즐겨찾기 목록을 불러오지 못했어요.";
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    const uid = $userState.user?.uid;
    if (!uid || !cursor) return;

    moreLoading = true;
    try {
      const r = await listFavoriteDiaries(uid, 20, cursor);
      items = [...items, ...r.items];
      cursor = r.nextCursor;
    } catch (e: any) {
      errorMsg = e?.message ?? "추가 로딩에 실패했어요.";
    } finally {
      moreLoading = false;
    }
  }

  function openDiary(id: string) {
    goto(`/diary/${id}`);
  }

  async function unfavorite(it: DiaryListItem) {
    const uid = $userState.user?.uid;
    if (!uid) return;

    // 낙관적 업데이트
    const prev = items;
    items = items.filter((x) => x.id !== it.id);

    try {
      await updateDiary(uid, it.id, { favorite: false });
    } catch (e: any) {
      // 실패 시 롤백
      items = prev;
      errorMsg = e?.message ?? "즐겨찾기 해제에 실패했어요.";
    }
  }

  $: if (!$userState.loading && $userState.user) loadFirst();
</script>

<div class="wrap">
  <div class="top">
    <button class="back" on:click={() => goto("/diary")}>←</button>
    <div class="hgroup">
      <div class="title">⭐ 즐겨찾기</div>
      <div class="sub">즐겨찾기한 일기만 모아봤어요</div>
    </div>
  </div>

  {#if loading}
    <div class="state">불러오는 중...</div>
  {:else if errorMsg}
    <div class="state err">{errorMsg}</div>
  {:else if items.length === 0}
    <div class="empty">
      <div class="emoji">📌</div>
      <div class="msg">아직 즐겨찾기한 일기가 없어요.</div>
      <button class="btn" on:click={() => goto("/diary")}>일기 보러가기</button>
    </div>
  {:else}
    <div class="list">
      {#each items as it (it.id)}
        <div class="card">
          <button class="main" on:click={() => openDiary(it.id)}>
            <div class="meta">
              <span class="date">{it.diaryDate}</span>
              <span class="star" title="즐겨찾기">★</span>
            </div>
            <div class="t">{it.title || "제목 없음"}</div>
            <div class="c">{it.content}</div>
          </button>

          <button class="ghost" on:click={() => unfavorite(it)} title="즐겨찾기 해제">
            해제
          </button>
        </div>
      {/each}
    </div>

    {#if cursor}
      <button class="more" on:click={loadMore} disabled={moreLoading}>
        {moreLoading ? "불러오는 중..." : "더 보기"}
      </button>
    {/if}
  {/if}
</div>

<style>
  .wrap {
    padding: 18px 16px 28px;
    max-width: 860px;
    margin: 0 auto;
    color: var(--text);
  }

  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .back {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
  }
  .hgroup .title {
    font-size: 18px;
    font-weight: 800;
    line-height: 1.1;
  }
  .hgroup .sub {
    margin-top: 4px;
    font-size: 12px;
    opacity: 0.7;
  }

  .state {
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--card);
    opacity: 0.85;
  }
  .state.err { color: #ef4444; }

  .empty {
    margin-top: 18px;
    padding: 18px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--card);
    text-align: center;
  }
  .empty .emoji { font-size: 28px; }
  .empty .msg { margin-top: 8px; opacity: 0.8; }
  .btn {
    margin-top: 14px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-weight: 700;
    cursor: pointer;
  }

  .list {
    display: grid;
    gap: 10px;
  }
  .card {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: stretch;
    border: 1px solid var(--border);
    background: var(--card);
    border-radius: 16px;
    overflow: hidden;
  }

  .main {
    text-align: left;
    padding: 14px;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    min-width: 0;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
    opacity: 0.75;
  }
  .star { opacity: 0.9; }
  .t {
    margin-top: 6px;
    font-weight: 800;
    font-size: 15px;
    line-height: 1.25;
    word-break: break-word;
  }
  .c {
    margin-top: 6px;
    font-size: 13px;
    opacity: 0.75;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  .ghost {
    width: 64px;
    border: none;
    border-left: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    cursor: pointer;
    font-weight: 700;
    opacity: 0.8;
  }
  .ghost:hover { opacity: 1; }

  .more {
    margin-top: 14px;
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-weight: 800;
    cursor: pointer;
  }
  .more:disabled { opacity: 0.6; cursor: default; }
</style>
