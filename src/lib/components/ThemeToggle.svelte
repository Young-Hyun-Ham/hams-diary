<!-- src/lib/components/ThemeToggle.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  const KEY = "anniv:theme:v1";
  type THEME_TYPE = "light" | "dark" | "system";

  let theme: THEME_TYPE = "light";

  function applyTheme(next: THEME_TYPE) {
    theme = next;
    document.documentElement.dataset.theme = next;
  }
  
  function setTheme(next: THEME_TYPE) {
    theme = next;
    document.documentElement.dataset.theme = next;
    localStorage.setItem(KEY, next);
  }

  onMount(() => {
    const ds = (document.documentElement.dataset.theme || "").trim();
    const ls = (localStorage.getItem(KEY) || "").trim();

    // ✅ dataset이 비어있으면 localStorage를 우선 사용
    const cur = (ds || ls || "light") as THEME_TYPE;

    // ✅ 초기에도 실제 적용까지!
    applyTheme(cur);
  });
</script>

<button class="toggle" on:click={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
  <span class="dot" />
  <span class="label">{theme === "dark" ? "Light" : "Dark"}</span>
</button>

<style>
  .toggle{
    height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--ring);
    background: var(--panel2);
    box-shadow: var(--shadow2);
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    backdrop-filter: blur(10px);
  }
  .dot{
    width: 10px; height: 10px; border-radius: 999px;
    background: linear-gradient(135deg, var(--brand), var(--brand2));
    box-shadow: 0 10px 18px rgba(255,90,167,0.22);
  }
  .label{ font-size: 12px; color: var(--muted); }
</style>
