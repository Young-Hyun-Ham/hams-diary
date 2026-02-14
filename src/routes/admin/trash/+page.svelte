<!-- src/routes/admin/trash/+page.svelte -->
 <script lang="ts">
    import { apiUrl } from "$lib/api";

  let loading = true;
  let errorMsg = "";
  let users: any[] = [];
  let busyUid: string | null = null;

  let bulkRunning = false;
  let bulkDone = 0;
  let bulkTotal = 0;

  async function load() {
    loading = true;
    errorMsg = "";
    try {
      const r = await fetch(apiUrl("/api/admin/trash/expired"));
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      users = j.users ?? [];
    } catch (e: any) {
      errorMsg = e?.message ?? "불러오기 실패";
    } finally {
      loading = false;
    }
  }

  async function purgeUser(uid: string, count: number) {
    const ok = confirm(`이 사용자의 삭제 대상 ${count}건을 완전 삭제할까요?\n(이미지 포함, 복구 불가)`);
    if (!ok) return;

    busyUid = uid;
    errorMsg = "";
    try {
      const r = await fetch(apiUrl(`/api/admin/trash/expired/${uid}`), { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } catch (e: any) {
      errorMsg = e?.message ?? "삭제 실패";
    } finally {
      busyUid = null;
    }
  }

  async function purgeAll() {
    if (!users.length) return;

    const total = users.reduce((sum, u) => sum + (u.count ?? 0), 0);
    const ok = confirm(`전체 삭제를 진행할까요?\n대상 사용자: ${users.length}명\n대상 건수: ${total}건\n(이미지 포함, 복구 불가)`);
    if (!ok) return;

    bulkRunning = true;
    bulkDone = 0;
    bulkTotal = users.length;
    errorMsg = "";

    try {
      const payload = {
        users: users.map((u) => ({ uid: u.uid, count: u.count ?? 0 }))
      };

      const r = await fetch(apiUrl("/api/admin/trash/expired/purgeAll"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) throw new Error(await r.text());

      const j = await r.json();
      bulkDone = j.done ?? 0;
      bulkTotal = j.total ?? 0;

      // 결과 반영
      await load();
    } catch (e: any) {
      errorMsg = e?.message ?? "전체삭제 실패";
    } finally {
      bulkRunning = false;
    }
  }

  load();
</script>

<div class="wrap">
  <div class="topbar">
    <h2 class="h">관리자 · 만료 삭제대상(24시간 경과)</h2>
    <div class="spacer"></div>

    <div class="bulk">
      <button class="btn danger" on:click={purgeAll} disabled={loading || bulkRunning || !users.length}>
        전체삭제
      </button>
      <button class="btn" on:click={load} disabled={loading || bulkRunning}>
        새로고침
      </button>
    </div>
  </div>

  {#if bulkRunning}
    <div class="state">전체삭제 진행 중… {bulkDone}/{bulkTotal}</div>
  {/if}

  {#if loading}
    <div class="state">불러오는 중...</div>
  {:else if errorMsg}
    <div class="state err">{errorMsg}</div>
  {:else if !users.length}
    <div class="state">삭제 대상이 없어요.</div>
  {:else}
    <div class="list">
      {#each users as u (u.uid)}
        <div class="row">
          <div class="main">
            <div class="title">
              {u.name}
              {#if u.email}<span class="email">{u.email}</span>{/if}
            </div>
            <div class="meta">
              <span>삭제대상 {u.count}건</span>
              <span class="dot">•</span>
              <span class="uid">{u.uid}</span>
            </div>
          </div>

          <div class="actions">
            <button
              class="btn danger"
              on:click={() => purgeUser(u.uid, u.count)}
              disabled={bulkRunning || busyUid === u.uid}
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
  .topbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .spacer { flex:1; }
  .h { margin:0; font-size:18px; font-weight:900; }

  .bulk { display:flex; gap:8px; }

  .state { padding: 14px; opacity: 0.75; }
  .err { color:#ef4444; opacity:1; }

  .list { display:grid; gap:10px; }
  .row{
    display:flex;
    align-items:center;
    gap:10px;
    padding:12px;
    border-radius:16px;
    border:1px solid var(--border);
    background: var(--card);
  }
  .main{ flex:1; min-width:0; display:grid; gap:6px; }
  .title{ font-weight:900; display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; }
  .email{ font-size:12px; opacity:0.6; font-weight:600; }
  .meta{ font-size:12px; opacity:0.65; display:flex; align-items:center; gap:6px; min-width:0; }
  .uid{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 260px; }
  .dot{ opacity:0.5; }

  .actions{ display:flex; gap:8px; }

  .btn{
    padding:8px 10px;
    border-radius:12px;
    border:1px solid var(--border);
    background: transparent;
    color: var(--text);
    font-size:13px;
    cursor:pointer;
    white-space:nowrap;
  }
  .danger{ background:#ef4444; color:#fff; border:none; font-weight:900; }
  .btn:disabled{ opacity:0.6; cursor:default; }
</style>
