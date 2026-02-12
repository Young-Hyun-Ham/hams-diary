<!-- src/routes/trash/+page.svelte -->
 <script lang="ts">
  import { onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { userState } from "$lib/stores/user";
  import { listDeletedDiaries, restoreDiary, hardDeleteDiaryAndImages } from "$lib/firebase/trashRepo";

  let loading = true;
  let errorMsg = "";
  let items: any[] = [];

  let busyId: string | null = null;

  // 전체 작업 상태
  let bulkMode: "restore" | "delete" | null = null;
  let bulkDone = 0;
  let bulkTotal = 0;

  // ===============================================================================
  // 안내 문구
  const TTL_MS = 24 * 60 * 60 * 1000;
  const WARN_MS = 2 * 60 * 60 * 1000; // 2시간 이하 남으면 강조(원하면 3시간으로 변경)

  function toMs(ts: any) {
    if (!ts) return null;
    // Firestore Timestamp
    if (typeof ts?.toMillis === "function") return ts.toMillis();
    // Date
    if (ts instanceof Date) return ts.getTime();
    // number
    if (typeof ts === "number") return ts;
    return null;
  }

  function formatRemain(ms: number) {
    if (ms <= 0) return "만료";
    const totalMin = Math.ceil(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;

    if (h <= 0) return `${m}분 남음`;
    if (m === 0) return `${h}시간 남음`;
    return `${h}시간 ${m}분 남음`;
  }

  function getTTLInfo(it: any) {
    const deletedAtMs = toMs(it.deletedAt);
    if (!deletedAtMs) return null;

    const expireAtMs = deletedAtMs + TTL_MS;
    const remainMs = expireAtMs - Date.now();

    return {
      remainMs,
      label: formatRemain(remainMs),
      urgent: remainMs > 0 && remainMs <= WARN_MS,
      expired: remainMs <= 0,
    };
  }

  const t = setInterval(() => {
    // Date.now()만 바뀌어도 ttl 계산이 달라지니까
    // Svelte가 rerender 하도록 더미 tick을 변경
    tick = Date.now();
  }, 60000);

  let tick = Date.now();
  onDestroy(() => clearInterval(t));
  // ===============================================================================


  async function load() {
    const uid = $userState.user?.uid;
    if (!uid) return;

    loading = true;
    errorMsg = "";
    try {
      items = await listDeletedDiaries(uid, 100);
    } catch (e: any) {
      errorMsg = e?.message ?? "불러오기 실패";
    } finally {
      loading = false;
    }
  }

  $: if (!$userState.loading && $userState.user) load();

  async function onRestore(id: string) {
    const uid = $userState.user?.uid;
    if (!uid) return;
    busyId = id;
    try {
      await restoreDiary(uid, id);
      await load();
    } catch (e: any) {
      errorMsg = e?.message ?? "복원 실패";
    } finally {
      busyId = null;
    }
  }

  async function onHardDelete(id: string) {
    const uid = $userState.user?.uid;
    if (!uid) return;

    const ok = confirm("완전 삭제할까요? (이미지 포함, 복구 불가)");
    if (!ok) return;

    busyId = id;
    try {
      await hardDeleteDiaryAndImages(uid, id);
      await load();
    } catch (e: any) {
      errorMsg = e?.message ?? "삭제 실패";
    } finally {
      busyId = null;
    }
  }

  function openItem(id: string) {
    goto(`/diary/${id}`);
  }

  // 전체 복원
  async function restoreAll() {
    const uid = $userState.user?.uid;
    if (!uid) return;

    if (!items.length) return;

    const ok = confirm(`휴지통의 ${items.length}개 항목을 모두 복원할까요?`);
    if (!ok) return;

    bulkMode = "restore";
    bulkDone = 0;
    bulkTotal = items.length;
    errorMsg = "";

    try {
      // 순차 처리(트랜잭션/쿼터 안정)
      for (const it of items) {
        await restoreDiary(uid, it.id);
        bulkDone += 1;
      }
      await load();
    } catch (e: any) {
      errorMsg = e?.message ?? "전체 복원 실패";
    } finally {
      bulkMode = null;
    }
  }

  // 전체 삭제(이미지 포함 hard delete)
  async function deleteAll() {
    const uid = $userState.user?.uid;
    if (!uid) return;

    if (!items.length) return;

    const ok = confirm(`휴지통의 ${items.length}개 항목을 모두 완전 삭제할까요?\n(이미지 포함, 복구 불가)`);
    if (!ok) return;

    bulkMode = "delete";
    bulkDone = 0;
    bulkTotal = items.length;
    errorMsg = "";

    try {
      for (const it of items) {
        await hardDeleteDiaryAndImages(uid, it.id);
        bulkDone += 1;
      }
      await load();
    } catch (e: any) {
      errorMsg = e?.message ?? "전체 삭제 실패";
    } finally {
      bulkMode = null;
    }
  }

  $: bulkRunning = bulkMode !== null;
  $: bulkText =
    bulkMode === "restore"
      ? `전체 복원 중… ${bulkDone}/${bulkTotal}`
      : bulkMode === "delete"
      ? `전체 삭제 중… ${bulkDone}/${bulkTotal}`
      : "";
</script>

<div class="wrap">
  <div class="topbar">
    <div class="titleRow">
      <h2 class="h">휴지통</h2>

      <div class="note" title="삭제된 일기는 24시간 동안 보관됩니다.">
        <svg class="noteIcon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="currentColor"
            d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm1 14h-2v-2h2v2Zm0-4h-2V6h2v6Z" />
        </svg>
        <span class="noteText">
          삭제된 일기는 <b>24시간 보관</b> 후 관리자에 의해 <b>완전 삭제</b>될 수 있어요.
        </span>
      </div>
    </div>
    <div class="spacer"></div>
    <!-- 전체 버튼: 새로고침 좌측 -->
    <div class="bulk">
      <button class="btn" on:click={load} disabled={loading || bulkRunning}>
        새로고침
      </button>
      <button class="btn" on:click={restoreAll} disabled={loading || bulkRunning || !items.length}>
        전체복원
      </button>
      <button class="btn danger" on:click={deleteAll} disabled={loading || bulkRunning || !items.length}>
        전체삭제
      </button>
    </div>
  </div>

  {#if loading}
    <div class="state">불러오는 중...</div>
  {:else if errorMsg}
    <div class="state err">{errorMsg}</div>
  {:else if !items.length}
    <div class="state">휴지통이 비어있어요.</div>
  {:else}
    <div class="list">
      {#each items as it (it.id)}
        {@const ttl = getTTLInfo(it)}

        <div class="row {ttl?.urgent ? 'urgent' : ''} {ttl?.expired ? 'expired' : ''}">
          <button class="main" type="button" on:click={() => openItem(it.id)}>
            <div class="title">{it.title || "제목 없음"}</div>

            <div class="meta">
              <span>{it.diaryDate}</span>
              <span class="dot">•</span>
              <span>첨부 {it.attachments?.length ?? 0}</span>

              {#if ttl}
                <span class="dot">•</span>
                <span class="ttlBadge" aria-label="남은 시간">
                  {ttl.label}
                </span>
              {/if}
            </div>
          </button>

          <div class="actions">
            <button
              class="btn"
              type="button"
              on:click={() => onRestore(it.id)}
              disabled={busyId === it.id}
            >
              복원
            </button>
            <button
              class="btn danger"
              type="button"
              on:click={() => onHardDelete(it.id)}
              disabled={busyId === it.id}
            >
              삭제
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .wrap { display:grid; gap: 12px; }
  .topbar { display:flex; align-items:center; gap: 10px; flex-wrap: wrap; }
  .spacer { flex: 1; }
  .h {
    font-size: 14px;
    font-weight: 900;
    margin: 0;

    white-space: nowrap;
    line-height: 1;
    flex-shrink: 0; /* 줄어들면서 깨지는 것 방지 */
  }

  .bulk { display:flex; gap: 8px; align-items:center; }

  .state { padding: 14px; opacity: 0.75; }
  .err { color:#ef4444; opacity: 1; }

  .list { display:grid; gap: 10px; }
  .row {
    display:flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--card);
  }

  .main {
    flex: 1;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--text);
    cursor: pointer;
    display:grid;
    gap: 6px;
    min-width: 0;
  }
  .title { font-weight: 900; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { font-size: 12px; opacity: 0.65; display:flex; align-items:center; gap: 6px; }
  .dot { opacity: 0.5; }

  .actions { display:flex; gap: 8px; }

  .btn {
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
  }
  .danger { background:#ef4444; color:#fff; border: none; font-weight: 900; }
  .btn:disabled { opacity: 0.6; cursor: default; }

  /* 휴지통 안내 문구 */
  .topbar{
    display:flex;
    align-items:center;
    gap: 10px;
    flex-wrap: wrap;   /* 기본은 wrap (모바일 대응) */
  }

  /* 왼쪽(제목+안내)은 한 줄 영역 */
  .titleRow{
    display:flex;
    align-items:center;
    gap: 10px;
    min-width: 0;
    flex: 1 1 auto;
  }

  /* 버튼 그룹 */
  .bulk{
    display:flex;
    gap: 8px;
    align-items:center;
    flex: 0 0 auto;
    white-space: nowrap;
  }

  /* 안내 pill: 데스크톱에선 말줄임, 모바일에선 2줄 가능 */
  .note{
    display:inline-flex;
    align-items:center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--panel2, var(--card));
    color: var(--text);
    opacity: 0.88;

    min-width: 0;
    overflow: hidden;
  }

  .noteText{
    font-size: 12px;
    line-height: 1.2;
    opacity: 0.75;
  }

  /* 데스크톱(웹): 한 줄 고정 + 버튼 오른쪽 */
  @media (min-width: 769px){
    .topbar{ flex-wrap: nowrap; }
    .note{ max-width: 560px; }
    .noteText{
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  /* 모바일: 버튼을 “다음 줄로” 내리고, 오른쪽으로 붙이기 */
  @media (max-width: 768px){
    .bulk{
      flex-basis: 100%;        /* 다음 줄로 */
      justify-content: flex-end; /* 우측 정렬 */
      margin-top: 2px;
    }

    .note{
      max-width: 100%;
      border-radius: 14px; /* pill → 카드 느낌 */
      padding: 8px 10px;
    }
    .noteText{
      white-space: normal;  /* 2줄 허용 */
      line-height: 1.35;
    }
  }

  /* 남은 시간 배지 */
  .ttlBadge{
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--panel2, rgba(255,255,255,0.04));
    font-size: 12px;
    opacity: 0.9;
    white-space: nowrap;
  }

  /* 24시간 임박: 카드 테두리/배경만 살짝 강조 */
  .row.urgent{
    border-color: rgba(245, 158, 11, 0.35); /* amber 계열 */
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.10);
  }

  /* 만료(이미 24시간 지남): 흐리게 표시(관리자 삭제 대상) */
  .row.expired{
    opacity: 0.8;
  }
  .row.expired .ttlBadge{
    opacity: 0.7;
  }
</style>
