<!-- src/routes/diary/new/+page.svelte -->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { userState } from "$lib/stores/user";
  import { addDiary } from "$lib/firebase/diaryRepo";
  import { uploadDiaryImage, type UploadedImage } from "$lib/firebase/storageRepo";
  import RichTextarea from "$lib/components/RichTextarea.svelte";

  function toYmd(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // query: ?date=YYYY-MM-DD 가 있으면 그 날짜로 기본 세팅
  $: qDate = $page.url.searchParams.get("date");
  let diaryDate = qDate ?? toYmd(new Date());

  let title = "";
  let favorite = false;

  // 타임라인 표시 토글 (기본 OFF)
  let showOnTimeline = false;

  // 타임라인 제목/요약 (비우면 저장 시 자동 보정)
  let timelineTitle = "";
  let timelineSummary = "";

  // RichTextarea가 바인딩할 값들
  let contentHtml = "";
  let contentText = "";
  let pending = new Map<string, { file: File; url: string }>();

  let contentImages: UploadedImage[] = []; // 본문용
  let attachments: UploadedImage[] = [];  // 하단 첨부용

  let saving = false;
  let errorMsg = "";
  
  let fileInputEl: HTMLInputElement | null = null; // 파일 한개만 등록 하도록 처리 하는 변수
  
  const diaryId =
    (globalThis.crypto?.randomUUID?.() ?? `d_${Date.now()}_${Math.random().toString(16).slice(2)}`);

  async function uploadPendingAndPatchHtml(uid: string) {
    // DOM 파서로 img[data-local] 찾아서 치환
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml || "", "text/html");

    const imgs = Array.from(doc.querySelectorAll("img[data-local]")) as HTMLImageElement[];

    const uploaded: UploadedImage[] = [];

    for (const img of imgs) {
      const localId = img.getAttribute("data-local") || "";
      const item = pending.get(localId);
      if (!item) continue;

      // 여기서만 업로드
      const u = await uploadDiaryImage(uid, diaryId, item.file);
      uploaded.push(u);

      // src를 실제 URL로 변경 + storage path 저장(나중에 삭제용)
      img.src = u.url;
      img.setAttribute("data-path", u.path);

      // local 속성 제거(임시표시 제거)
      img.removeAttribute("data-local");
    }

    // content 업로드 목록 누적
    contentImages = [...contentImages, ...uploaded];

    // 치환된 HTML로 교체
    contentHtml = doc.body.innerHTML;

    // 저장 후에는 pending 정리(로컬 URL revoke)
    for (const [, v] of pending) URL.revokeObjectURL(v.url);
    pending = new Map();

    return uploaded;
  }
  
  // 선택한 이미지(저장 전)
  let imgFiles: File[] = [];
  let imgPreviews: { url: string; name: string; size: number }[] = [];

  function onPickImages(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) return;

    // 기존 선택 유지 + 추가(append)
    const nextFiles = [...imgFiles, ...files];
    imgFiles = nextFiles;

    // preview도 추가
    const nextPrev = [
      ...imgPreviews,
      ...files.map((f) => ({ url: URL.createObjectURL(f), name: f.name, size: f.size })),
    ];
    imgPreviews = nextPrev;

    // 같은 파일 다시 선택 가능하도록 reset
    input.value = "";
  }

  function removeImageAt(i: number) {
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

  function backToList() {
    // date filter 유지해서 돌아가기
    goto(`/diary?date=${encodeURIComponent(diaryDate)}`);
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

  async function save() {
    errorMsg = "";
    if (saving) return;

    const uid = $userState.user?.uid;
    if (!uid) return (errorMsg = "로그인이 필요해요.");
    if (!contentText.trim()) return (errorMsg = "내용을 입력해줘.");

    saving = true;

    try {
      // 1) 본문(pending) 업로드 + html 치환 (여기서 images에 누적됨)
      await uploadPendingAndPatchHtml(uid);

      if (contentHtml.includes('src="blob:') || contentHtml.includes("src='blob:")) {
        throw new Error("본문에 업로드되지 않은 blob 이미지가 남아있어요. data-local 삽입을 확인하세요.");
      }

      // 2) 하단 첨부 이미지 업로드
      const uploadedBottom: UploadedImage[] = [];
      for (const f of imgFiles) {
        const u = await uploadDiaryImage(uid, diaryId, f);
        uploadedBottom.push(u);
      }

      // 3) images에 합쳐서 저장
      attachments = [...attachments, ...uploadedBottom];
      const actorName = $userState.user?.displayName ?? "";
      await addDiary(
        uid,
          {
          diaryDate,
          title: title.trim(),
          contentHtml,
          contentText,
          favorite,
          contentImages,
          attachments,

          // NEW: 타임라인
          showOnTimeline,
          timelineTitle: showOnTimeline ? autoTimelineTitle() : "",
          timelineSummary: showOnTimeline ? autoTimelineSummary() : "",
          timelineDate: diaryDate, // 타임라인에서 날짜 기준으로 쓰기 좋게
        }, 
        diaryId,
        actorName,
      );

      await goto(`/diary?date=${encodeURIComponent(diaryDate)}`);
    } catch (e: any) {
      errorMsg = e?.message ?? "저장 실패";
    } finally {
      saving = false;
    }
  }
</script>

<div class="wrap">
  <div class="topbar">
    <button class="btn" type="button" on:click={backToList}>← 목록</button>
    <div class="spacer"></div>
    <button class="btn primary" type="button" on:click={save} disabled={saving}>
      {saving ? "저장 중..." : "저장"}
    </button>
  </div>

  <div class="panel">
    <label class="field">
      <div class="labelRow">
        <div class="label">기록 날짜</div>

        <!-- 즐겨찾기: 라벨 우측으로 이동 -->
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

      <!-- textarea처럼 보이지만, 글+이미지 혼합 가능 -->
      <RichTextarea
        placeholder="오늘의 이야기를 적어보세요…"
        bind:html={contentHtml}
        bind:text={contentText}
        bind:pending
      />
    </div>
    
    <div class="row">
      <!-- 타임라인 표시 토글 -->
      <div class="toggleWrap">
        <div class="toggleLabel">
          <div class="t1">타임라인 표시</div>
          <div class="t2">기본으로 타임라인 화면에 함께 보여요</div>
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
    <!-- 기존 제목/내용 UI 그대로 두고, 아래만 추가 -->

    <label class="field">
      <div class="label">이미지</div>
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
          {#each imgPreviews as p, i}
            <div class="thumb">
              <img src={p.url} alt={p.name} />
              <button type="button" class="x" on:click={() => removeImageAt(i)}>×</button>
            </div>
          {/each}
        </div>
      {/if}
    </label>

    {#if errorMsg}<div class="err">{errorMsg}</div>{/if}

    <button class="cta" type="button" on:click={save} disabled={saving}>
      {saving ? "저장 중..." : "저장하기"}
    </button>
  </div>
</div>

<style>
  .wrap { display:grid; gap: 12px; }

  .topbar {
    display:flex;
    align-items:center;
    gap: 10px;
  }
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
  .primary {
    background: #4f46e5;
    color: #fff;
    border: none;
    font-weight: 800;
  }
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
  
  .labelRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 6px;
  }

  /* 기존 .label이 margin-bottom을 갖고 있으면 labelRow로 이동했으니 label의 margin-bottom 제거/완화 */
  .label {
    font-size: 12px;
    opacity: 0.75;
    margin-bottom: 0; /* labelRow에서 처리 */
  }

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

  .favBtn .star {
    font-size: 14px;
    opacity: 0.55;
  }

  .favBtn .txt {
    opacity: 0.8;
  }

  .favBtn.on {
    border-color: rgba(251, 191, 36, 0.55);
    background: rgba(251, 191, 36, 0.12);
  }

  .favBtn.on .star {
    opacity: 1;
  }

  .input {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    outline: none;
  }

  .err { color:#ef4444; font-size: 13px; }.err { margin: 10px 0 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(239,68,68,.35); background: rgba(239,68,68,.08); color: #ef4444; }

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
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
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
