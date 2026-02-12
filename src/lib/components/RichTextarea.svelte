<!-- src/lib/components/RichTextarea.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  export let placeholder = "내용을 입력하세요…";

  // 저장할 HTML/텍스트 (부모 바인딩)
  export let html = "";
  export let text = "";

  // 저장 전 임시 이미지(로컬 파일) 목록
  // localId -> { file, url }
  export let pending = new Map<string, { file: File; url: string }>();

  let editorEl: HTMLDivElement | null = null;
  let fileEl: HTMLInputElement | null = null;

  // 외부 html 주입 루프 방지용
  let lastAppliedHtml = "";
  let composing = false; // IME 입력(한글 조합) 중 커서 튐 방지

  function syncOut() {
    if (!editorEl) return;
    html = editorEl.innerHTML ?? "";
    text = (editorEl.innerText ?? "").trim();
    lastAppliedHtml = html; // 사용자가 편집한 결과를 기준으로 갱신
  }

  let localError = "";
  function openPicker() {
    localError = "";

    if (hasAnyImage()) {
      localError = "본문 이미지는 1장만 추가할 수 있어요. 기존 이미지를 삭제한 뒤 다시 추가해 주세요.";
      return;
    }
    fileEl?.click();
  }

  function genId() {
    return (globalThis.crypto?.randomUUID?.() ??
      `l_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  }

  // (핵심) 외부에서 html 변경 → editor에 반영
  function applyExternalHtml(next: string) {
    if (!editorEl) return;

    const normalized = next ?? "";

    // 1) 동일하면 무시
    if (normalized === lastAppliedHtml) return;

    // 2) 조합 중이면 적용하지 않음(커서 튐 방지)
    if (composing) return;

    // 3) 포커스가 editor에 있고 사용자가 입력 중인 상황에서는
    //    부모에서 html을 재세팅하는 경우만 반영되도록(루프/커서튐 최소화)
    const active = document.activeElement;
    const isEditing = active === editorEl;

    if (isEditing) {
      // 사용자가 포커스 잡고 타이핑 중이면 강제 덮어쓰기 하지 않음
      // (다만 부모에서 "완전히 다른 글"로 교체하는 케이스는 rare)
      return;
    }

    editorEl.innerHTML = normalized;
    lastAppliedHtml = normalized;

    // text도 맞춰줌
    text = (editorEl.innerText ?? "").trim();
  }

  // Svelte 반응형: html이 바뀌면 editor에 적용
  $: if (editorEl) {
    applyExternalHtml(html);
  }

  // 커서 위치에 HTML 삽입
  function insertHtmlAtCursor(htmlStr: string) {
    editorEl?.focus();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      editorEl?.insertAdjacentHTML("beforeend", htmlStr);
      syncOut();
      return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const tmp = document.createElement("div");
    tmp.innerHTML = htmlStr;

    const frag = document.createDocumentFragment();
    let node: ChildNode | null;
    let last: ChildNode | null = null;
    while ((node = tmp.firstChild)) last = frag.appendChild(node);

    range.insertNode(frag);

    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    syncOut();
  }

  function removeLocalImageById(localId: string) {
    const v = pending.get(localId);
    if (v?.url) URL.revokeObjectURL(v.url);
    pending.delete(localId);
  }

  function removeNodeAndMaybeCleanup(node: Node) {
    const el = node instanceof Element ? node : null;
    const img =
      el?.tagName === "IMG"
        ? (el as HTMLImageElement)
        : (el?.querySelector?.("img[data-local]") as HTMLImageElement | null);

    const localId = img?.getAttribute?.("data-local") ?? null;

    node.parentNode?.removeChild(node);
    if (localId) removeLocalImageById(localId);

    syncOut();
  }

  // Backspace로 이미지 삭제
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "Backspace") return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;

    let node = range.startContainer;
    let offset = range.startOffset;

    if (node.nodeType === Node.TEXT_NODE) {
      if (offset > 0) return;

      const prev = node.previousSibling;
      if (prev instanceof Element) {
        if (prev.matches(".rt-img, figure.rt-img, span.rt-img")) {
          e.preventDefault();
          removeNodeAndMaybeCleanup(prev);
          return;
        }
        if (prev.tagName === "IMG" && prev.hasAttribute("data-local")) {
          e.preventDefault();
          removeNodeAndMaybeCleanup(prev);
          return;
        }
      }

      const pPrev = (node.parentNode as any)?.previousSibling;
      if (pPrev instanceof Element) {
        if (pPrev.matches(".rt-img, figure.rt-img, span.rt-img")) {
          e.preventDefault();
          removeNodeAndMaybeCleanup(pPrev);
          return;
        }
        if (pPrev.tagName === "IMG" && pPrev.hasAttribute("data-local")) {
          e.preventDefault();
          removeNodeAndMaybeCleanup(pPrev);
          return;
        }
      }
      return;
    }

    if (node instanceof Element) {
      const child = node.childNodes[offset - 1];
      if (child instanceof Element) {
        if (child.matches(".rt-img, figure.rt-img, span.rt-img")) {
          e.preventDefault();
          removeNodeAndMaybeCleanup(child);
          return;
        }
        if (child.tagName === "IMG" && child.hasAttribute("data-local")) {
          e.preventDefault();
          removeNodeAndMaybeCleanup(child);
          return;
        }
      }

      const prev = node.previousElementSibling;
      if (
        prev &&
        (prev.matches(".rt-img, figure.rt-img, span.rt-img") ||
          (prev.tagName === "IMG" && prev.hasAttribute("data-local")))
      ) {
        e.preventDefault();
        removeNodeAndMaybeCleanup(prev);
        return;
      }
    }
  }

  function onCompositionStart() {
    composing = true;
  }
  function onCompositionEnd() {
    composing = false;
    // 조합이 끝나면 최신 내용 다시 sync
    syncOut();
  }

  // 파일 선택 시: 업로드 X, blob 삽입 O (여러 장 가능)
  async function handlePick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) return;

    for (const f of files) {
      const id = genId();
      const url = URL.createObjectURL(f);
      pending.set(id, { file: f, url });

      insertHtmlAtCursor(`<img class="rt-img" data-local="${id}" src="${url}" alt="" />`);
    }

    input.value = "";
  }

  function hasAnyImage(): boolean {
    if (!editorEl) return false;

    // (1) 임시 이미지(pending) 존재
    const pendingCount = pending.size;

    // (2) 이미 업로드된 이미지(data-path) 존재
    const savedImgs = editorEl.querySelectorAll("img[data-path]").length;

    // (3) 임시 이미지(data-local) 존재
    const localImgs = editorEl.querySelectorAll("img[data-local]").length;

    return pendingCount + savedImgs + localImgs > 0;
  }

  // 마운트 시(수정 화면 진입) html 주입
  onMount(() => {
    if (editorEl) {
      editorEl.innerHTML = html ?? "";
      lastAppliedHtml = editorEl.innerHTML ?? "";
      text = (editorEl.innerText ?? "").trim();
    }
  });

  // pending의 blob url은 부모 save에서 업로드 후 정리하지만,
  // 혹시 화면 이탈 시 남아있으면 정리(안전)
  onDestroy(() => {
    for (const [, v] of pending) {
      try { if (v?.url) URL.revokeObjectURL(v.url); } catch {}
    }
  });
</script>

<div class="editorWrap">
  <div
    class="editor"
    bind:this={editorEl}
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    data-placeholder={placeholder}
    on:input={syncOut}
    on:blur={syncOut}
    on:keydown={onKeyDown}
    on:compositionstart={onCompositionStart}
    on:compositionend={onCompositionEnd}
  />

  <button class="imgBtn" type="button" on:click={openPicker} title="이미지 추가" aria-label="이미지 추가">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor"
        d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM8.5 11.5 11 14.5l2.5-3 3.5 4.5H5l3.5-4.5ZM8 8a1.5 1.5 0 1 0 0-.01Z" />
    </svg>
  </button>

  {#if localError}
    <div class="imgErr">{localError}</div>
  {/if}

  <!-- <input bind:this={fileEl} type="file" accept="image/*" multiple on:change={handlePick} style="display:none" /> -->
  <!-- firebase 스토리지 용량 이슈로 한개만 처리 가능 하게 변경 처리 -->
  <input bind:this={fileEl} type="file" accept="image/*" on:change={handlePick} style="display:none" />
</div>

<style>
  .editorWrap { position: relative; }

  .editor {
    min-height: 45vh;
    padding: 12px;
    padding-right: 46px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    outline: none;
    line-height: 1.55;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .editor:empty::before {
    content: attr(data-placeholder);
    opacity: 0.55;
  }

  .imgBtn {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  :global(img.rt-img) {
    display: block;
    width: 100%;
    height: auto;
    max-height: 320px;
    object-fit: cover;
    border-radius: 14px;
    border: 1px solid var(--border);
    margin: 4px 0;
  }
</style>
