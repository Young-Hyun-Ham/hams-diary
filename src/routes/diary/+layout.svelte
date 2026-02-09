<!-- src/routes/diary/+layout.svelte -->
<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { userState } from "$lib/stores/user";

  $: if (browser && !$userState.loading && !$userState.user) {
    goto("/login");
  }
</script>

<slot />
