<!-- src/reoutes/diary/+page.svelte -->
<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { userState } from "$lib/stores/user";
  import { listDiaries, listDiariesByDate } from "$lib/firebase/diaryListRepo";

  let loading = true;
  let errorMsg = "";
  let items: any[] = [];

  let cursor: any = undefined; // 전체보기 페이징용
  let hasMore = false;

  // url query: ?date=YYYY-MM-DD
  $: selectedDate = $page.url.searchParams.get("date");

  async function load() {
    if (!browser) return;
    const uid = $userState.user?.uid;
    if (!uid) return;

    loading = true;
    errorMsg = "";
    items = [];
    cursor = undefined;
    hasMore = false;

    try {
      if (selectedDate) {
        const res = await listDiariesByDate(uid, selectedDate, 100);
        items = res.items;
      } else {
        const res = await listDiaries(uid, 20);
        items = res.items;
        cursor = res.nextCursor;
        hasMore = !!cursor;
      }
    } catch (e: any) {
      errorMsg = e?.message ?? "목록 조회 실패";
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    const uid = $userState.user?.uid;
    if (!uid || !cursor) return;

    try {
      const res = await listDiaries(uid, 20, cursor);
      items = [...items, ...res.items];
      cursor = res.nextCursor;
      hasMore = !!cursor;
    } catch (e: any) {
      errorMsg = e?.message ?? "추가 로딩 실패";
    }
  }

  function clearDateFilter() {
    goto("/diary");
  }

  function openTimeline() {
    goto("/timeline");
  }

  function openFavicon() {
    goto("/favorites");
  }

  function openCalendar() {
    goto("/diary/calendar");
  }

  function openNew() {
    // 작성 화면(이전 단계에서 /diary/new 만들어둔 상태 가정)
    // 작성 화면에서 diaryDate를 selectedDate로 기본 세팅하고 싶으면 query로 넘길 수 있음
    goto(selectedDate ? `/diary/new?date=${encodeURIComponent(selectedDate)}` : "/diary/new");
  }

  // 로그인 상태 준비되면 로드
  $: if (browser && !$userState.loading && $userState.user) {
    load();
  }

  // date가 바뀌면 재로드
  $: if (browser && !$userState.loading && $userState.user) {
    // selectedDate 변화 감지용 (Svelte는 $: 블록으로 충분)
    // load()는 위 블록에서도 실행되지만, query param 변경 때도 실행되도록 유지
    selectedDate;
    load();
  }
</script>

<div class="wrap">
  <div class="filters">
    <div class="left">
      {#if selectedDate}
        <div class="chip">
          <span class="label">선택 날짜</span>
          <span class="value">{selectedDate}</span>
        </div>
        <button class="btn" type="button" on:click={clearDateFilter}>전체보기</button>
      {:else}
        <div class="chip">
          <span class="label">전체</span>
          <span class="value">최신순</span>
        </div>
      {/if}
    </div>

    <div class="right">
      <button class="btn" type="button" on:click={openFavicon}>즐겨찾기</button>
      <button class="btn" type="button" on:click={openTimeline}>타임라인</button>
      <button class="btn" type="button" on:click={openCalendar}>달력</button>
    </div>
  </div>

  {#if loading}
    <div class="state">로딩 중...</div>
  {:else if errorMsg}
    <div class="state err">{errorMsg}</div>
  {:else if items.length === 0}
    <div class="empty">
      <div class="t">등록한 내용이 없어요</div>
      <div class="s">{selectedDate ? "이 날짜에 첫 내용을 작성해볼까요?" : "첫 내용를 작성해볼까요?"}</div>
      <button class="primary" type="button" on:click={openNew}>작성</button>
    </div>
  {:else}
    <div class="list">
      {#each items as d}
        <a class="card" href={`/diary/${d.id}`}>
          <div class="meta">
            <div class="date">{d.diaryDate}</div>
            {#if d.favorite}<div class="fav">★</div>{/if}
          </div>
          <div class="title">{d.title || "제목 없음"}</div>
          <div class="preview">{(d.content || "").slice(0, 90)}{(d.content || "").length > 90 ? "…" : ""}</div>
        </a>
      {/each}
    </div>

    {#if !selectedDate && hasMore}
      <button class="more" type="button" on:click={loadMore}>더 보기</button>
    {/if}
  {/if}

  <button class="fab" type="button" on:click={openNew} aria-label="새 Diary 작성">＋</button>
</div>

<style>
  .wrap { display: grid; gap: 12px; }

  .filters {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .left, .right { display:flex; align-items:center; gap:10px; }

  .chip {
    display: inline-flex;
    gap: 8px;
    align-items: baseline;
    padding: 8px 10px;
    border-radius: 999px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .label { font-size: 12px; opacity: 0.65; }
  .value { font-size: 12px; font-weight: 700; }

  .btn {
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-size: 13px;
    cursor: pointer;
  }

  .list { display:flex; flex-direction:column; gap:12px; }
  .card {
    display:block;
    padding:16px;
    border-radius:16px;
    background: var(--card);
    border: 1px solid var(--border);
    text-decoration:none;
    color: inherit;
  }

  .meta { display:flex; justify-content:space-between; align-items:center; }
  .date { font-size: 12px; opacity: 0.65; }
  .fav { font-size: 12px; opacity: 0.8; }

  .title { margin-top: 6px; font-weight: 800; }
  .preview { margin-top: 6px; font-size: 14px; opacity: 0.8; line-height: 1.5; }

  .state { padding: 12px; opacity: 0.75; }
  .err { color:#ef4444; opacity:1; }

  .empty {
    margin-top: 8px;
    padding: 18px;
    border-radius: 18px;
    background: var(--card);
    border: 1px solid var(--border);
    display: grid;
    gap: 8px;
    text-align: center;
  }
  .empty .t { font-weight: 900; }
  .empty .s { font-size: 13px; opacity: 0.75; }
  .primary {
    margin-top: 6px;
    padding: 12px 14px;
    border-radius: 14px;
    border: none;
    background: #4f46e5;
    color: white;
    font-weight: 800;
    cursor: pointer;
  }

  .more {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--card);
    cursor: pointer;
  }

  .fab {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: none;
    background: #4f46e5;
    color: white;
    font-size: 28px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
</style>
