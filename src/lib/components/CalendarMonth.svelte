<!-- src/lib/components/CalendarMonth.svelte -->
<script lang="ts">
  import { monthRange, pad2 } from "$lib/utils/date";
  import type { DiaryDaySummary } from "$lib/firebase/diaryCalendarRepo";

  export let ym: string; // "YYYY-MM"
  export let summaryMap: Map<string, DiaryDaySummary>; // date -> summary
  export let selectedDate: string | null = null; // "YYYY-MM-DD"
  export let onPick: (ymd: string) => void;

  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  function daysInMonth(y: number, m1: number) {
    // m1: 1~12
    return new Date(y, m1, 0).getDate();
  }
  function firstWeekday(y: number, m1: number) {
    // 0=Sun
    return new Date(y, m1 - 1, 1).getDay();
  }

  function ymd(y: number, m1: number, d: number) {
    return `${y}-${pad2(m1)}-${pad2(d)}`;
  }

  $: parsed = ym.match(/^(\d{4})-(\d{2})$/);
  $: year = parsed ? Number(parsed[1]) : new Date().getFullYear();
  $: month = parsed ? Number(parsed[2]) : new Date().getMonth() + 1;

  $: total = daysInMonth(year, month);
  $: offset = firstWeekday(year, month);

  // 6주 고정 그리드(달력 UI 흔들림 방지)
  $: cells = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - offset + 1;
    if (dayNum < 1 || dayNum > total) return null;
    const date = ymd(year, month, dayNum);
    const s = summaryMap.get(date);
    return {
      date,
      day: dayNum,
      count: s?.count ?? 0,
      has: (s?.count ?? 0) > 0,
      favorite: !!s?.hasFavorite,
    };
  });
</script>

<div class="cal">
  <div class="week">
    {#each WEEK as w}
      <div class="w">{w}</div>
    {/each}
  </div>

  <div class="grid">
    {#each cells as c, idx}
      {#if c === null}
        <div class="cell empty" aria-hidden="true" />
      {:else}
        <button
          type="button"
          class="cell {c.has ? 'has' : ''} {selectedDate === c.date ? 'sel' : ''}"
          on:click={() => onPick(c.date)}
          aria-label={`${c.date} ${c.count ? `${c.count}개 일기` : '일기 없음'}`}
        >
          <div class="top">
            <div class="d">{c.day}</div>
            {#if c.count > 0}
              <div class="badge">{c.count}</div>
            {/if}
          </div>

          <div class="marks">
            {#if c.has}
              <span class="dot" />
            {/if}
            {#if c.favorite}
              <span class="star" title="즐겨찾기 포함">★</span>
            {/if}
          </div>
        </button>
      {/if}
    {/each}
  </div>
</div>

<style>
  .cal {
    display: grid;
    gap: 10px;
  }

  .week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
    padding: 0 2px;
  }
  .w {
    text-align: center;
    font-size: 12px;
    opacity: 0.7;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
  }

  .cell {
    height: 54px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    padding: 8px;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 120ms ease, border-color 120ms ease;
  }
  .cell:hover { transform: translateY(-1px); }
  .cell.has { border-color: rgba(79, 70, 229, 0.35); }
  .cell.sel { outline: 2px solid rgba(79, 70, 229, 0.45); outline-offset: 1px; }

  .cell.empty {
    border: 1px dashed var(--border);
    background: transparent;
    cursor: default;
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .d { font-weight: 700; font-size: 13px; }

  .badge {
    min-width: 22px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: rgba(79, 70, 229, 0.12);
    border: 1px solid rgba(79, 70, 229, 0.25);
    font-size: 12px;
    display: grid;
    place-items: center;
  }

  .marks {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(79, 70, 229, 0.9);
  }
  .star {
    font-size: 12px;
    opacity: 0.75;
  }

  /* 모바일에서 터치 영역 넉넉하게 */
  @media (max-width: 390px) {
    .cell { height: 50px; padding: 7px; border-radius: 12px; }
  }
</style>
