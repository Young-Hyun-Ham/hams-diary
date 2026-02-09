<!-- src/routes/diary/calendar/+page.svelte -->
<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { userState } from "$lib/stores/user";
  import { getDiaryDaysByMonth } from "$lib/firebase/diaryCalendarRepo";
  import CalendarMonth from "$lib/components/CalendarMonth.svelte";

  function addMonth(ym: string, delta: number) {
    const m = ym.match(/^(\d{4})-(\d{2})$/);
    if (!m) return ym;
    let y = Number(m[1]);
    let mo = Number(m[2]) + delta;
    while (mo < 1) { y -= 1; mo += 12; }
    while (mo > 12) { y += 1; mo -= 12; }
    return `${y}-${String(mo).padStart(2, "0")}`;
  }

  function todayYM() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  let ym = todayYM();
  let selectedDate: string | null = null;

  let loading = true;
  let errorMsg = "";
  let summaryMap = new Map();

  async function load() {
    if (!browser) return;
    const uid = $userState.user?.uid;
    if (!uid) return;

    loading = true;
    errorMsg = "";
    try {
      const res = await getDiaryDaysByMonth(uid, ym);
      summaryMap = res.map;
    } catch (e: any) {
      errorMsg = e?.message ?? "달력 데이터 조회 실패";
    } finally {
      loading = false;
    }
  }

  $: if (browser && !$userState.loading && $userState.user) {
    load();
  }

  function pick(ymd: string) {
    selectedDate = ymd;
    goto(`/diary?date=${encodeURIComponent(ymd)}`);
  }
</script>

<div class="wrap">
  <div class="topbar">
    <button class="nav" type="button" on:click={() => (ym = addMonth(ym, -1)) && load()}>‹</button>
    <div class="title">{ym}</div>
    <button class="nav" type="button" on:click={() => (ym = addMonth(ym, +1)) && load()}>›</button>
  </div>

  {#if loading}
    <div class="state">로딩 중...</div>
  {:else if errorMsg}
    <div class="state err">{errorMsg}</div>
  {:else}
    <CalendarMonth {ym} {summaryMap} {selectedDate} onPick={pick} />
  {/if}
</div>

<style>
  .wrap { display: grid; gap: 12px; }
  .topbar {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    gap: 10px;
  }
  .title {
    text-align: center;
    font-weight: 800;
    letter-spacing: 0.2px;
  }
  .nav {
    height: 40px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-size: 18px;
    cursor: pointer;
  }
  .state { padding: 12px; opacity: 0.75; }
  .err { color: #ef4444; opacity: 1; }
</style>
