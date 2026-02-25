<!-- src/lib/components/CalendarMonth.svelte -->
<script lang="ts">
  import { monthRange, pad2 } from "$lib/utils/date";
  import type { DiaryDaySummary } from "$lib/firebase/diaryCalendarRepo";
  import { onMount } from "svelte";

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

  // 화면 크기에 따라 셀 크기 조정
  let sizeType = "small"; // small, medium, large
  onMount(() => {
    const check = () => {
      sizeType = window.innerWidth <= 420 ? "small" : window.innerWidth <= 480 ? "medium" : "large";
    };

    check();
    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  });

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
              <div class="badge">
                {sizeType === "small" || sizeType === "medium"
                  ? "9+" // (c.count > 9 ? "9+" : c.count)
                  : "99+" // (c.count > 99 ? "99+" : c.count)
                }
              </div>
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
    width: 100%;
    max-width: 100%;
  }

  .week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
    padding: 0 2px;
    width: 100%;
    max-width: 100%;
  }

  .w {
    text-align: center;
    font-size: 12px;
    opacity: 0.7;
    min-width: 0;
    white-space: nowrap;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
    max-width: 100%;
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

    /* ✅ 내용이 커져도 칸이 줄어들 수 있게 */
    min-width: 0;

    /* ✅ 앱(웹뷰)에서 폰트가 커져도 튀는 것 방지 */
    overflow: hidden;
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
    gap: 4px;

    width: 100%;
    min-width: 0;

    /* ✅ badge를 "우측 기준 고정"하기 위한 기준 */
    padding-right: 2px;
  }

  .d {
    font-weight: 700;
    font-size: 12px;
    min-width: 0;
  }

  .badge {
    flex: 0 0 auto;

    /* ✅ 앱/웹 모두 안정적으로: 너무 작아지지/커지지 않게 */
    min-width: 20px;
    height: 18px;

    padding: 0 2px;
    border-radius: 999px;

    background: rgba(79, 70, 229, 0.12);
    border: 1px solid rgba(79, 70, 229, 0.25);

    font-size: 9px;
    display: grid;
    place-items: center;
    white-space: nowrap;

    /* ✅ 항상 우측으로 붙이고, 우측은 top의 padding-right(2px)로 통일 */
    margin-left: auto;
    margin-right: 0;
  }

  .marks {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
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

  /* ✅ 모바일(실기기 폭 대응): 390이 아니라 420 정도가 안정적 */
  @media (max-width: 420px) {
    .cell {
      height: 50px;
      padding: 3px;
      border-radius: 12px;
    }

    .d {
      font-size: 12px;
    }

    .badge {
      min-width: 18px;
      height: 16px;
      font-size: 9px;
      padding: 0 2px;
    }
  }

  /* ✅ 아주 작은 폰(구형/작은 Android) */
  @media (max-width: 360px) {
    .cell {
      height: 48px;
      padding: 2px;
    }
    .badge {
      display: none;
    }
  }

  /* ✅ 태블릿/데스크톱: 약간 여유 있게 */
  @media (min-width: 769px) {
    .cell {
      height: 58px;
      padding: 9px;
      border-radius: 14px;
    }
    .d { font-size: 13px; }
    .badge { min-width: 22px; height: 19px; font-size: 10px; }
  }
</style>