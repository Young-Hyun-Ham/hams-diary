<!-- src/routes/diary/[id]/edit/+page.svelte -->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { userState } from "$lib/stores/user";
  import RichTextarea from "$lib/components/RichTextarea.svelte";

  import { getDiary } from "$lib/firebase/diaryDetailRepo";
  import { updateDiary, deleteDiary, softDeleteDiary } from "$lib/firebase/diaryRepo";
  import { uploadDiaryImage, type UploadedImage } from "$lib/firebase/storageRepo";
  import { deleteStoragePath } from "$lib/firebase/storageRepo";

  let diaryId: any = "";
  $: diaryId = $page.params.id;

  let loading = true;
  let saving = false;
  let deleting = false;
  let errorMsg = "";

  // 폼 상태(등록 화면과 동일)
  let diaryDate = "";
  let title = "";
  let favorite = false;

  let contentHtml = "";
  let contentText = "";
  let pending = new Map<string, { file: File; url: string }>();

  // ✅ 기존에 저장된 이미지들(본문+하단 포함해서 한 배열로 관리)
  let contentImages: UploadedImage[] = []; // 본문용
  let attachments: UploadedImage[] = [];  // 하단 첨부용
  let removedPaths = new Set<string>(); // 삭제 요청된 기존 이미지 path 모음

  // ✅ 하단 이미지 추가(저장 전)
  let imgFiles: File[] = [];
  let imgPreviews: { url: string; name: string; size: number }[] = [];

  function onPickImages(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) return;

    imgFiles = [...imgFiles, ...files];
    imgPreviews = [
      ...imgPreviews,
      ...files.map((f) => ({ url: URL.createObjectURL(f), name: f.name, size: f.size })),
    ];
    input.value = "";
  }

  function removeNewImageAt(i: number) {
    const nextFiles = imgFiles.slice();
    const nextPrev = imgPreviews.slice();
    URL.revokeObjectURL(nextPrev[i].url);
    nextFiles.splice(i, 1);
    nextPrev.splice(i, 1);
    imgFiles = nextFiles;
    imgPreviews = nextPrev;
  }

  // ✅ 기존 이미지 제거(저장 시 Storage에서도 삭제)
  function removeExistingImageAt(i: number) {
    const it = attachments[i];
    if (it?.path) removedPaths.add(it.path);

    const next = attachments.slice();
    next.splice(i, 1);
    attachments = next;
  }

  async function load() {
    const uid = $userState.user?.uid;
    if (!uid || !diaryId) return;

    loading = true;
    errorMsg = "";
    try {
      const d = await getDiary(uid, diaryId);

      diaryDate = d.diaryDate ?? "";
      title = d.title ?? "";
      favorite = !!d.favorite;

      contentHtml = d.contentHtml ?? "";
      contentText = d.contentText ?? "";

      contentImages = (d.contentImages ?? []) as UploadedImage[];
      attachments = (d.attachments ?? []) as UploadedImage[];
    } catch (e: any) {
      errorMsg = e?.message ?? "불러오기 실패";
    } finally {
      loading = false;
    }
  }

  $: if (!$userState.loading && $userState.user && diaryId) {
    load();
  }

  async function uploadPendingAndPatchHtml(uid: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml || "", "text/html");

    const imgs = Array.from(doc.querySelectorAll("img[data-local]")) as HTMLImageElement[];
    const uploaded: UploadedImage[] = [];

    for (const img of imgs) {
      const localId = img.getAttribute("data-local") || "";
      const item = pending.get(localId);
      if (!item) continue;

      const u = await uploadDiaryImage(uid, diaryId, item.file);
      uploaded.push(u);

      img.src = u.url;
      img.setAttribute("data-path", u.path);
      img.removeAttribute("data-local");
    }

    // 업로드 목록 누적
    contentImages = [...contentImages, ...uploaded];
    contentHtml = doc.body.innerHTML;

    // pending 정리
    for (const [, v] of pending) URL.revokeObjectURL(v.url);
    pending = new Map();

    return uploaded;
  }

  async function save() {
    errorMsg = "";
    if (saving) return;

    const uid = $userState.user?.uid;
    if (!uid) return (errorMsg = "로그인이 필요해요.");
    if (!contentText.trim()) return (errorMsg = "내용을 입력해줘.");

    saving = true;
    try {
      // 1) 본문 pending 이미지 업로드 + html 치환
      await uploadPendingAndPatchHtml(uid);

      // 2) 하단 이미지 업로드 후 images에 추가
      const uploadedBottom: UploadedImage[] = [];
      for (const f of imgFiles) {
        const u = await uploadDiaryImage(uid, diaryId, f);
        uploadedBottom.push(u);
      }
      if (uploadedBottom.length) {
        attachments = [...attachments, ...uploadedBottom];
      }

      // 3) Firestore 업데이트(트랜잭션으로 diaryDays도 갱신)
      await updateDiary(uid, diaryId, {
        diaryDate,
        title: title.trim(),
        contentHtml,
        contentText,
        favorite,
        contentImages,
        attachments,
      });

      // 4) 제거된 기존 이미지(Storage) 삭제
      //    (Firestore 업데이트 성공 후에 실행해야 데이터 유실 위험이 줄어듦)
      for (const p of removedPaths) {
        try { await deleteStoragePath(p); } catch {}
      }
      removedPaths = new Set();

      // 5) 하단 새 이미지 preview 정리
      for (const p of imgPreviews) URL.revokeObjectURL(p.url);
      imgFiles = [];
      imgPreviews = [];

      await goto(`/diary/${diaryId}`);
    } catch (e: any) {
      errorMsg = e?.message ?? "수정 저장 실패";
    } finally {
      saving = false;
    }
  }

  async function removeDiary() {
    if (deleting) return;
    const uid = $userState.user?.uid;
    if (!uid) return (errorMsg = "로그인이 필요해요.");

    deleting = true;
    errorMsg = "";
    try {
      // 1) Firestore 삭제(트랜잭션으로 diaryDays도 감소)
      // hard delete
      // await deleteDiary(uid, diaryId);
      // soft delete -> 휴지통에서 완전 삭제 처리 함.
      await softDeleteDiary(uid, diaryId);

      // 2) Storage 이미지 삭제(실패해도 페이지 이동)
      for (const it of attachments) {
        if (it?.path) {
          try { await deleteStoragePath(it.path); } catch {}
        }
      }

      await goto(`/diary?date=${encodeURIComponent(diaryDate)}`);
    } catch (e: any) {
      errorMsg = e?.message ?? "삭제 실패";
    } finally {
      deleting = false;
    }
  }

  function back() {
    goto(`/diary/${diaryId}`);
  }
</script>

{#if loading}
  <div class="state">로딩 중...</div>
{:else}
  <div class="wrap">
    <div class="topbar">
      <button class="btn" type="button" on:click={back}>← 상세</button>
      <div class="spacer"></div>
      <button class="btn danger" type="button" on:click={removeDiary} disabled={deleting}>
        {deleting ? "삭제 중..." : "삭제"}
      </button>
      <button class="btn primary" type="button" on:click={save} disabled={saving}>
        {saving ? "저장 중..." : "수정 저장"}
      </button>
    </div>

    <div class="panel">
      <label class="field">
        <div class="label">기록 날짜</div>
        <input class="input" type="date" bind:value={diaryDate} />
      </label>

      <label class="field">
        <div class="label">제목</div>
        <input class="input" placeholder="오늘의 제목" bind:value={title} />
      </label>

      <div class="field">
        <div class="label">내용</div>
        <RichTextarea
          placeholder="오늘의 이야기를 적어보세요…"
          bind:html={contentHtml}
          bind:text={contentText}
          bind:pending
        />
      </div>

      <label class="favRow">
        <input type="checkbox" bind:checked={favorite} />
        <span>즐겨찾기</span>
      </label>

      <!-- ✅ 기존 이미지 목록(삭제 가능) -->
      {#if attachments.length}
        <div class="block">
          <div class="labelRow">
            <div class="label">등록된 이미지</div>
            <div class="hint">×로 제거하면 저장 시 반영됩니다</div>
          </div>
          <div class="grid">
            {#each attachments as p, i}
              <div class="thumb">
                <img src={p.url} alt={p.name ?? "image"} />
                <button type="button" class="x" on:click={() => removeExistingImageAt(i)}>×</button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- ✅ 하단 이미지 추가(multiple) -->
      <div class="block">
        <div class="labelRow">
          <div class="label">이미지 추가</div>
          <div class="hint">* 여러 장 선택 가능</div>
        </div>
        <input class="input" type="file" accept="image/*" multiple on:change={onPickImages} />

        {#if imgPreviews.length}
          <div class="grid">
            {#each imgPreviews as p, i}
              <div class="thumb">
                <img src={p.url} alt={p.name} />
                <button type="button" class="x" on:click={() => removeNewImageAt(i)}>×</button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if errorMsg}<div class="err">{errorMsg}</div>{/if}
    </div>
  </div>
{/if}

<style>
  .wrap { display:grid; gap: 12px; }
  .topbar { display:flex; align-items:center; gap: 10px; }
  .spacer { flex: 1; }
  .state { padding: 14px; opacity: 0.75; }

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
  .danger { background:#ef4444; color:#fff; border:none; font-weight:800; }
  .btn:disabled { opacity: 0.7; cursor: default; }

  .panel {
    padding: 16px;
    border-radius: 18px;
    background: var(--card);
    border: 1px solid var(--border);
    display:grid;
    gap: 12px;
  }

  .field { display:grid; gap: 6px; }
  .label { font-size: 12px; opacity: 0.7; }

  .input {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    outline: none;
  }

  .favRow { display:flex; align-items:center; gap: 8px; font-size: 13px; opacity: 0.9; }
  .err { color:#ef4444; font-size: 13px; }

  .block { display:grid; gap: 8px; }
  .labelRow { display:flex; align-items:baseline; justify-content:space-between; gap: 10px; }
  .hint { font-size: 12px; opacity: 0.6; }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .thumb {
    position: relative;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--card);
    aspect-ratio: 1 / 1;
  }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .x {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(0,0,0,0.45);
    color: white;
    cursor: pointer;
  }
</style>
