<!-- src/routes/diary/[id]/edit/+page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { userState } from "$lib/stores/user";
  import { getDiary } from "$lib/firebase/diaryDetailRepo";
  import { updateDiary } from "$lib/firebase/diaryRepo";
  import { uploadDiaryImage, deleteStoragePath, type UploadedImage } from "$lib/firebase/storageRepo";
  import RichTextarea from "$lib/components/RichTextarea.svelte";

  $: diaryId = $page.params.id as string;

  // ====== form state ======
  let diaryDate = "";
  let title = "";
  let favorite = false;

  // 타임라인
  let showOnTimeline = false;
  let timelineTitle = "";
  let timelineSummary = "";

  // RichTextarea bind
  let contentHtml = "";
  let contentText = "";
  let pending = new Map<string, { file: File; url: string }>();

  // 기존 저장된 이미지 메타
  let contentImages: UploadedImage[] = []; // 본문용(이미 올라간 것)
  let attachments: UploadedImage[] = [];  // 첨부(이미 올라간 것)

  // 새로 추가할 첨부 이미지(저장 전)
  let imgFiles: File[] = [];
  let imgPreviews: { url: string; name: string; size: number }[] = [];

  // 원본 스냅샷 + 삭제 목록 변수 추가
  let originalAttachments: UploadedImage[] = [];
  let originalContentImages: UploadedImage[] = [];
  let removedAttachmentPaths: string[] = [];

  let loading = true;
  let saving = false;
  let errorMsg = "";

  let loadedForKey = ""; // uid+id 기준으로 1회 로드 제어

  let fileInputEl: HTMLInputElement | null = null; // 파일 한개만 등록 하도록 처리 하는 변수

  function back() {
    // 수정 완료/취소 시 원문 상세로
    goto(`/diary/${encodeURIComponent(diaryId)}`);
  }

  function autoTimelineTitle() {
    const t = timelineTitle.trim();
    if (t) return t;
    const tt = title.trim();
    return tt ? tt : "기록";
  }

  function autoTimelineSummary() {
    const s = timelineSummary.trim();
    if (s) return s;
    const text = (contentText || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > 80 ? text.slice(0, 80) + "…" : text;
  }

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
    // multi로 파일 선택 가능 할 경우
    // const nextFiles = imgFiles.slice();
    // const nextPrev = imgPreviews.slice();

    // URL.revokeObjectURL(nextPrev[i].url);
    // nextFiles.splice(i, 1);
    // nextPrev.splice(i, 1);

    // imgFiles = nextFiles;
    // imgPreviews = nextPrev;

    // 파일 1개만 처리 하도록 초기화
    // preview revoke
    imgPreviews.forEach((p) => URL.revokeObjectURL(p.url));

    // ✅ 1장 정책이면 그냥 통째로 비우는 게 맞음
    imgFiles = [];
    imgPreviews = [];

    // ✅ input도 초기화(같은 파일 재선택 가능)
    if (fileInputEl) fileInputEl.value = "";
  }

  // 기존 첨부 이미지 제거(스토리지 삭제는 다음 단계로)
  function removeExistingAttachmentAt(i: number) {
    const target = attachments[i];
    if (target?.path) removedAttachmentPaths = [...removedAttachmentPaths, target.path];

    const next = attachments.slice();
    next.splice(i, 1);
    attachments = next;
  }

  // 본문 HTML에서 “현재 살아있는 data-path” 추출 함수
  function extractKeptContentPaths(html: string) {
    const kept = new Set<string>();
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html || "", "text/html");
      const imgs = Array.from(doc.querySelectorAll("img[data-path]")) as HTMLImageElement[];
      for (const img of imgs) {
        const p = img.getAttribute("data-path");
        if (p) kept.add(p);
      }
    } catch {}
    return kept;
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

      // 수정 화면에서도 diaryId 그대로 경로에 사용
      const u = await uploadDiaryImage(uid, diaryId, item.file);
      uploaded.push(u);

      img.src = u.url;
      img.setAttribute("data-path", u.path);
      img.removeAttribute("data-local");
    }

    contentImages = [...contentImages, ...uploaded];
    contentHtml = doc.body.innerHTML;

    for (const [, v] of pending) URL.revokeObjectURL(v.url);
    pending = new Map();

    return uploaded;
  }

  async function loadDiary(uid: string) {
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

      // 원본 보관 (비교용)
      originalAttachments = [...attachments];
      originalContentImages = [...contentImages];
      removedAttachmentPaths = [];

      // 타임라인 필드 (없으면 기본 ON)
      showOnTimeline = d.showOnTimeline !== false;
      timelineTitle = d.timelineTitle ?? "";
      timelineSummary = d.timelineSummary ?? "";

      // 새 첨부 선택 초기화
      for (const p of imgPreviews) URL.revokeObjectURL(p.url);
      imgFiles = [];
      imgPreviews = [];
    } catch (e: any) {
      errorMsg = e?.message ?? "일기를 불러오지 못했어요.";
    } finally {
      loading = false;
    }
  }

  // 새로고침/초기 진입에서 user 늦게 붙는 문제 해결: uid가 생기면 로드
  $: if ($userState.user?.uid && diaryId) {
    const key = `${$userState.user.uid}:${diaryId}`;
    if (loadedForKey !== key) {
      loadedForKey = key;
      loadDiary($userState.user.uid);
    }
  }

  onMount(() => {
    // 별도 작업 없음(reactive load가 담당)
  });

  async function save() {
    errorMsg = "";
    if (saving) return;

    const uid = $userState.user?.uid;
    if (!uid) return (errorMsg = "로그인이 필요해요.");
    if (!contentText.trim()) return (errorMsg = "내용을 입력해줘.");

    saving = true;
    try {
      // 1) 본문 pending 업로드 + html 치환
      await uploadPendingAndPatchHtml(uid);

      if (contentHtml.includes('src="blob:') || contentHtml.includes("src='blob:")) {
        throw new Error("본문에 업로드되지 않은 blob 이미지가 남아있어요.");
      }

      // 2) 새 첨부 이미지 업로드
      const uploadedBottom: UploadedImage[] = [];
      for (const f of imgFiles) {
        const u = await uploadDiaryImage(uid, diaryId, f);
        uploadedBottom.push(u);
      }
      attachments = [...attachments, ...uploadedBottom];

      // 본문에서 살아남은 path들
      const keptContent = extractKeptContentPaths(contentHtml);

      // 원본 본문 이미지 중, html에서 사라진 path = 삭제 대상
      const removedContentPaths = originalContentImages
        .map((x) => x.path)
        .filter((p) => p && !keptContent.has(p));

      // 첨부는 UI에서 제거된 것만 삭제 대상(removedAttachmentPaths)
      const removedAttachPaths = removedAttachmentPaths.slice();

      // 3) updateDiary
      await updateDiary(uid, diaryId, {
        diaryDate,
        title: title.trim(),
        contentHtml,
        contentText,
        favorite,
        contentImages,
        attachments,

        // 타임라인
        showOnTimeline,
        timelineTitle: showOnTimeline ? autoTimelineTitle() : "",
        timelineSummary: showOnTimeline ? autoTimelineSummary() : "",
        timelineDate: diaryDate,
      } as any);

      // Firestore 저장 성공 후에 Storage 삭제 (실패해도 저장은 유지)
      const allToDelete = Array.from(new Set([...removedContentPaths, ...removedAttachPaths]));
      await Promise.allSettled(allToDelete.map((p) => deleteStoragePath(p)));

      originalAttachments = [...attachments];
      originalContentImages = [...contentImages];
      removedAttachmentPaths = [];

      // 완료 후 상세로
      await goto(`/diary/${encodeURIComponent(diaryId)}`);
    } catch (e: any) {
      errorMsg = e?.message ?? "저장 실패";
    } finally {
      saving = false;
    }
  }
</script>

{#if loading}
  <div class="panel">불러오는 중...</div>
{:else}
  <div class="wrap">
    <div class="topbar">
      <button class="btn" type="button" on:click={back}>← 돌아가기</button>
      <div class="spacer"></div>
      <button class="btn primary" type="button" on:click={save} disabled={saving}>
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>

    <div class="panel">
      <label class="field">
        <div class="labelRow">
          <div class="label">기록 날짜</div>

          <button
            type="button"
            class="favBtn {favorite ? 'on' : ''}"
            aria-pressed={favorite}
            on:click={() => (favorite = !favorite)}
            title={favorite ? "즐겨찾기 해제" : "즐겨찾기"}
          >
            <span class="star">★</span>
            <span class="txt">즐겨찾기</span>
          </button>
        </div>

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

      <div class="row">
        <div class="toggleWrap">
          <div class="toggleLabel">
            <div class="t1">타임라인 표시</div>
            <div class="t2">타임라인 화면에 노출할지 선택해요</div>
          </div>

          <button
            type="button"
            class="toggle {showOnTimeline ? 'on' : 'off'}"
            aria-pressed={showOnTimeline}
            on:click={() => (showOnTimeline = !showOnTimeline)}
          >
            <span class="knob" />
          </button>
        </div>
      </div>

      {#if showOnTimeline}
        <div class="timelineBox">
          <div class="miniTitle">타임라인 카드 정보</div>

          <label class="field">
            <div class="label">타임라인 제목</div>
            <input
              class="input"
              placeholder="비우면 제목/기록으로 자동 저장"
              bind:value={timelineTitle}
            />
          </label>

          <label class="field">
            <div class="label">한 줄 요약</div>
            <input
              class="input"
              placeholder="비우면 내용 앞부분으로 자동 저장"
              bind:value={timelineSummary}
            />
          </label>
        </div>
      {/if}
    </div>

    <div class="panel">
      <div class="label">기존 첨부 이미지</div>
      {#if attachments.length === 0}
        <div class="hint">첨부 이미지가 없어요.</div>
      {:else}
        <div class="grid">
          {#each attachments as a, i (a.url)}
            <div class="thumb">
              <img src={a.url} alt="attachment" />
              <button type="button" class="x" on:click={() => removeExistingAttachmentAt(i)}>×</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    
    <div class="panel">
      {#if attachments.length === 0}
        <label class="field">
          <div class="label">이미지 추가</div>
          <!-- <input class="input" type="file" accept="image/*" multiple on:change={onPickImages} /> -->
          <!-- firebase 스토리지 용량 이슈로 한개만 처리 가능 하게 변경 처리 -->
          
          <!-- 진짜 input은 숨김 -->
          <input
            class="fileHidden"
            type="file"
            accept="image/*"
            bind:this={fileInputEl}
            on:change={onPickImages}
            disabled={imgFiles.length > 0}
          />

          <!-- 커스텀 UI -->
          <button
            type="button"
            class="fileBtn"
            on:click={() => fileInputEl?.click()}
            disabled={imgFiles.length > 0}
          >
            {imgFiles.length > 0 ? "이미지 선택됨 (변경하려면 삭제)" : "이미지 선택"}
          </button>

          <div class="fileHint">
            {imgFiles.length > 0
              ? "이미지 1장이 선택되었습니다. X로 삭제 후 다시 선택할 수 있어요."
              : "* 이미지는 1장만 등록할 수 있어요"}
          </div>

          {#if imgPreviews.length}
            <div class="grid">
              {#each imgPreviews as p, i (p.url)}
                <div class="thumb">
                  <img src={p.url} alt={p.name} />
                  <button type="button" class="x" on:click={() => removeNewImageAt(i)}>×</button>
                </div>
              {/each}
            </div>
          {/if}
        </label>
      {/if}

      {#if errorMsg}<div class="err">{errorMsg}</div>{/if}

      <button class="cta" type="button" on:click={save} disabled={saving}>
        {saving ? "저장 중..." : "수정하기"}
      </button>
    </div>
  </div>
{/if}

<style>
  .wrap { display:grid; gap: 12px; }

  .topbar { display:flex; align-items:center; gap: 10px; }
  .spacer { flex: 1; }

  .btn {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-size: 13px;
    cursor: pointer;
  }
  .primary { background: #4f46e5; color: #fff; border: none; font-weight: 800; }
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

  .labelRow { display:flex; align-items:center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
  .label { font-size: 12px; opacity: 0.75; margin-bottom: 0; }

  .favBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--border, rgba(0,0,0,.12));
    background: var(--card, transparent);
    color: var(--text, inherit);
    font-size: 12px;
    line-height: 1;
    white-space: nowrap;
  }
  .favBtn .star { font-size: 14px; opacity: 0.55; }
  .favBtn .txt { opacity: 0.8; }
  .favBtn.on { border-color: rgba(251, 191, 36, 0.55); background: rgba(251, 191, 36, 0.12); }
  .favBtn.on .star { opacity: 1; }

  .input {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    outline: none;
  }

  .row { display:flex; align-items:flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

  .toggleWrap { display:flex; align-items:center; justify-content: space-between; gap: 12px; flex: 1; min-width: 260px; padding: 8px 0; }
  .toggleLabel .t1 { font-weight: 800; font-size: 13px; }
  .toggleLabel .t2 { font-size: 12px; opacity: .7; margin-top: 2px; }

  .toggle {
    width: 52px; height: 30px; border-radius: 999px;
    border: 1px solid var(--border, rgba(0,0,0,.12));
    background: rgba(0,0,0,.12);
    position: relative;
    padding: 0;
  }
  .toggle.on { background: rgba(34,197,94,.35); }
  .toggle.off { background: rgb(98, 95, 95); }

  .knob {
    width: 24px; height: 24px; border-radius: 999px;
    background: var(--card, #fff);
    position: absolute; top: 50%;
    transform: translateY(-50%);
    left: 3px;
    transition: left .15s ease;
    box-shadow: 0 6px 16px rgba(0,0,0,.12);
  }
  .toggle.on .knob { left: 25px; }

  /* 다크모드 + OFF 상태에서 knob 흰색 보장 */
  .dark .toggle.off .knob { background: #fff; }

  .timelineBox {
    margin-top: 10px;
    padding-top: 12px;
    border-top: 1px dashed var(--border, rgba(0,0,0,.12));
  }
  .miniTitle { font-size: 12px; font-weight: 800; margin-bottom: 10px; opacity: .85; }

  .cta {
    margin-top: 4px;
    padding: 12px 14px;
    border-radius: 14px;
    border: none;
    background: #4f46e5;
    color: white;
    font-weight: 900;
    cursor: pointer;
  }
  .cta:disabled { opacity: 0.7; cursor: default; }

  .hint { font-size: 12px; opacity: 0.6; margin-top: 6px; }

  .grid {
    margin-top: 10px;
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

  .err {
    margin: 10px 0 12px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(239,68,68,.35);
    background: rgba(239,68,68,.08);
    color: #ef4444;
    font-size: 13px;
  }

  .fileHidden {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .fileBtn {
    width: 100%;
    padding: 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .fileBtn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .fileHint {
    font-size: 12px;
    opacity: 0.6;
    margin-top: 6px;
  }
</style>
