<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { userState } from "$lib/stores/user";

  $: if (browser && !$userState.loading) {
    if ($userState.user) {
      goto("/diary");
    } else {
      goto("/login");
    }
  }
</script>

<div style="padding:16px; opacity:0.7">
  로그인 상태 확인 중...
</div>
