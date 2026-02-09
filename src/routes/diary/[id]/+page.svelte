<!-- src/routes/diary/[id]/+page.svelte -->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { userState } from "$lib/stores/user";
  import { getDiary } from "$lib/firebase/diaryDetailRepo";
  import { restoreDiary, hardDeleteDiaryAndImages } from "$lib/firebase/trashRepo";

  let diaryId: any = "";
  $: diaryId = $page.params.id;

  let loading = true;
  let errorMsg = "";
  let d: any = null;

  async function load() {
    const uid = $userState.user?.uid;
    if (!uid || !diaryId) return;
    loading = true;
    errorMsg = "";
    try {
      d = await getDiary(uid, diaryId);
    } catch (e: any) {
      errorMsg = e?.message ?? "불러오기 실패";
    } finally {
      loading = false;
    }
  }

  $: if (!$userState.loading && $userState.user && diaryId) load();

  function back() {
    // goto(`/diary?date=${encodeURIComponent(d?.diaryDate ?? "")}`);
    goto("/diary");
  }
  function trashBack() {
    goto("/trash");
  }
  function edit() {
    goto(`/diary/${diaryId}/edit`);
  }

  // 복원 로직
  let acting = false;

  async function restore() {
    const uid = $userState.user?.uid;
    if (!uid || !diaryId) return;

    acting = true;
    errorMsg = "";
    try {
      await restoreDiary(uid, diaryId);
      // 다시 로드해서 UI 갱신
      await load();
    } catch (e: any) {
      errorMsg = e?.message ?? "복원 실패";
    } finally {
      acting = false;
    }
  }

  async function hardDelete() {
    const uid = $userState.user?.uid;
    if (!uid || !diaryId) return;

    const ok = confirm("완전 삭제할까요? (이미지 포함, 복구 불가)");
    if (!ok) return;

    acting = true;
    errorMsg = "";
    try {
      await hardDeleteDiaryAndImages(uid, diaryId);
      await goto(`/trash`);
    } catch (e: any) {
      errorMsg = e?.message ?? "삭제 실패";
    } finally {
      acting = false;
    }
  }
</script>

{#if loading}
  <div class="state">로딩 중...</div>
{:else if errorMsg}
  <div class="state err">{errorMsg}</div>
{:else}
  <div class="wrap">
    <div class="topbar">
      {#if !d?.deleted}
        <button class="btn" type="button" on:click={back}>← 목록</button>
        <div class="spacer"></div>
        <button class="btn primary" type="button" on:click={edit}>수정</button>
      {:else}
        <button class="btn" type="button" on:click={trashBack}>← 목록</button>
      {/if}
    </div>

    <div class="card">
      <div class="meta">
        <div class="date">{d.diaryDate}</div>
        {#if d.favorite}<div class="fav">★</div>{/if}
      </div>
      <div class="title">{d.title || "제목 없음"}</div>

      <div class="body">
        {@html d.contentHtml}
      </div>
    </div>

    {#if d?.deleted}
      <div class="trashBanner">
        <div class="msg">
          이 글은 휴지통에 있어요.
        </div>
        <div class="trashActions">
          <button class="btn" type="button" on:click={restore} disabled={acting}>
            복원
          </button>
          <button class="btn danger" type="button" on:click={hardDelete} disabled={acting}>
            완전 삭제
          </button>
        </div>
      </div>
    {/if}
  </div>

  {#if d?.attachments?.length}
    <div class="grid">
      {#each d.attachments as p}
        <div class="thumb">
          <img src={p.url} alt={p.name ?? "image"} />
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .wrap { display:grid; gap: 12px; }
  .topbar { display:flex; align-items:center; gap: 10px; }
  .spacer { flex: 1; }
  .state { padding: 14px; opacity: 0.75; }
  .err { color:#ef4444; opacity: 1; }

  .btn {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-size: 13px;
    cursor: pointer;
  }
  .primary { background:#4f46e5; color:#fff; border:none; font-weight:800; }

  .card {
    padding: 16px;
    border-radius: 18px;
    background: var(--card);
    border: 1px solid var(--border);
    display:grid;
    gap: 10px;
  }
  .meta { display:flex; justify-content:space-between; }
  .date { font-size: 12px; opacity: 0.65; }
  .fav { font-size: 12px; opacity: 0.8; }
  .title { font-weight: 900; font-size: 18px; }

  /* 본문에서 이미지가 잘 보이게 */
  .body :global(img) {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 10px 0;
    border-radius: 14px;
    border: 1px solid var(--border);
  }

  .grid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .thumb {
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--card);
    aspect-ratio: 1 / 1;
  }
  .thumb img { width:100%; height:100%; object-fit:cover; display:block; }

  .trashBanner{
    margin-top: 8px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px dashed var(--border);
    background: var(--panel2);
    display:flex;
    align-items:center;
    justify-content: space-between;
    gap: 10px;
  }
  .trashBanner .msg{
    font-size: 12px;
    opacity: 0.8;
  }
  .trashActions{
    display:flex;
    gap: 8px;
  }
  .danger{
    background:#ef4444;
    color:#fff;
    border:none;
    font-weight: 900;
  }
</style>
