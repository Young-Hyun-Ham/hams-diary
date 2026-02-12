<!-- src/routes/timeline/+page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { userState } from "$lib/stores/user";
  import {
    listTimelineDiaries,
    type DiaryListItem,
  } from "$lib/firebase/diaryListRepo";
  import type { QueryDocumentSnapshot } from "firebase/firestore";

  let loading = true;
  let loadingMore = false;
  let errorMsg = "";

  let items: DiaryListItem[] = [];
  let nextCursor: QueryDocumentSnapshot | undefined;
  let hasMore = true;

  let sentinel: HTMLDivElement | null = null;
  let io: IntersectionObserver | null = null;

  function fmtYmd(ymd: string) {
    try {
      const [y, m, d] = ymd.split("-").map((x) => Number(x));
      const dt = new Date(y, m - 1, d);
      return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      }).format(dt);
    } catch {
      return ymd;
    }
  }

  function titleOf(it: DiaryListItem) {
    const t = (it.timelineTitle ?? "").trim();
    if (t) return t;
    const tt = (it.title ?? "").trim();
    return tt ? tt : "기록";
  }

  function summaryOf(it: DiaryListItem) {
    const s = (it.timelineSummary ?? "").trim();
    if (s) return s;
    const text = (it.content ?? "").replace(/\s+/g, " ").trim();
    if (!text) return "내용 미리보기가 없어요.";
    return text.length > 90 ? text.slice(0, 90) + "…" : text;
  }

  function groupByTimelineDate(list: DiaryListItem[]) {
    const map = new Map<string, DiaryListItem[]>();
    for (const it of list) {
      const key = it.timelineDate ?? it.diaryDate ?? "unknown";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([date, entries]) => ({ date, entries }));
  }

  $: visibleItems = items.filter((it) => it.showOnTimeline !== false);
  $: grouped = groupByTimelineDate(visibleItems);
  

  // user가 준비되는 순간/유저가 바뀌는 순간 재로딩
  let loadedForUid: string | null = null;
  $: if ($userState.user?.uid && loadedForUid !== $userState.user.uid) {
    loadedForUid = $userState.user.uid;
    loadFirst($userState.user.uid);
  }
  $: if (io && sentinel) {
    io.observe(sentinel);
  }

  async function loadFirst(uid: string) {
    loading = true;
    errorMsg = "";
    items = [];
    nextCursor = undefined;
    hasMore = true;

    try {
      const r = await listTimelineDiaries(uid, 15);
      items = r.items;
      nextCursor = r.nextCursor as any;
      hasMore = !!nextCursor && r.items.length > 0;
    } catch (e: any) {
      errorMsg = e?.message ?? "타임라인을 불러오지 못했어요.";
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    const u = $userState.user;
    if (!u || !nextCursor) return;

    loadingMore = true;
    try {
      const r = await listTimelineDiaries(u.uid, 15, nextCursor);
      items = [...items, ...r.items];
      nextCursor = r.nextCursor as any;
      hasMore = !!nextCursor && r.items.length > 0;
    } catch (e: any) {
      errorMsg = e?.message ?? "추가 로딩에 실패했어요.";
    } finally {
      loadingMore = false;
    }
  }

  function openDiary(id: string) {
    goto(`/diary/${id}`);
  }

  onMount(() => {
    io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "200px 0px", threshold: 0.01 }
    );

    if (sentinel) io.observe(sentinel);

    return () => {
      if (io && sentinel) io.unobserve(sentinel);
      io?.disconnect();
      io = null;
    };
  });
</script>

<div class="wrap">
  <header class="top">
    <button class="back" on:click={() => goto("/diary")} aria-label="back">←</button>
    <div class="ttl">
      <div class="h">타임라인</div>
      <div class="s">타임라인 표시 ON인 기록만 모아 보여줘요</div>
    </div>
  </header>

  {#if loading}
    <div class="state">불러오는 중...</div>
  {:else if errorMsg}
    <div class="state err">{errorMsg}</div>
  {:else if items.length === 0}
    <div class="state empty">
      아직 타임라인에 표시할 기록이 없어요.
      <div class="mini">Diary 등록에서 “타임라인 표시”를 켜면 여기에 보여요.</div>
    </div>
  {:else}
    <div class="timeline">
      {#each grouped as g (g.date)}
        <section class="day">
          <div class="day-head">
            <div class="dot" aria-hidden="true"></div>
            <div class="date">{fmtYmd(g.date)}</div>
          </div>

          <div class="cards">
            {#each g.entries as it (it.id)}
              <button class="card" on:click={() => openDiary(it.id)}>
                <div class="card-top">
                  <div class="title">{titleOf(it)}</div>
                  {#if it.favorite}
                    <span class="fav" title="즐겨찾기">★</span>
                  {/if}
                </div>

                <div class="preview">{summaryOf(it)}</div>

                <div class="meta">
                  <span class="pill">타임라인</span>
                  <span class="arrow">자세히 보기 →</span>
                </div>
              </button>
            {/each}
          </div>
        </section>
      {/each}

      <div class="sentinel" bind:this={sentinel}></div>

      {#if loadingMore}
        <div class="more">더 불러오는 중...</div>
      {:else if !hasMore}
        <div class="more done">마지막 항목이에요</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap {
    padding: 16px;
    color: var(--text);
    background: var(--bg);
    min-height: 100%;
  }

  .top {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 14px;
  }
  .back {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-size: 18px;
    display: grid;
    place-items: center;
  }
  .ttl .h { font-weight: 800; font-size: 16px; }
  .ttl .s { margin-top: 2px; font-size: 12px; opacity: .7; }

  .state {
    padding: 28px 14px;
    border: 1px dashed var(--border);
    border-radius: 14px;
    background: var(--card);
    text-align: center;
    opacity: .9;
  }
  .state.err { color: #ef4444; border-style: solid; }
  .state.empty .mini { margin-top: 6px; font-size: 12px; opacity: .7; }

  .timeline {
    position: relative;
    padding-left: 18px;
  }
  .timeline::before {
    content: "";
    position: absolute;
    left: 8px;
    top: 6px;
    bottom: 6px;
    width: 2px;
    background: var(--border);
    opacity: .9;
  }

  .day { margin-bottom: 22px; }
  .day-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 6px 0 10px;
  }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background: var(--card);
    border: 2px solid var(--border);
    position: relative;
    left: -18px;
  }
  .date { font-weight: 800; font-size: 13px; }

  .cards { display: grid; gap: 10px; }

  .card {
    text-align: left;
    width: 100%;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    border-radius: 16px;
    padding: 12px;
    transition: transform .08s ease;
  }
  .card:active { transform: scale(0.99); }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .title { font-weight: 800; font-size: 14px; line-height: 1.2; }
  .fav { font-size: 14px; opacity: .9; }

  .preview {
    margin-top: 8px;
    font-size: 12px;
    opacity: .75;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.35;
  }

  .meta {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .pill {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    opacity: .9;
  }
  .arrow { font-size: 11px; opacity: .7; }

  .sentinel { height: 1px; }

  .more {
    margin: 10px 0 4px;
    text-align: center;
    font-size: 12px;
    opacity: .75;
  }
  .more.done { opacity: .55; }

  @media (min-width: 860px) {
    .wrap { max-width: 860px; margin: 0 auto; }
    .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
