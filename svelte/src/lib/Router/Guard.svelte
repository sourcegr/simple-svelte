<script>
    import {checkPermissions} from './Router.svelte';

    let isAllowed = true;
    export let guard = null;

    $: if (guard) {
        isAllowed = checkPermissions(guard);
    }
</script>

{#if isAllowed}
    <slot/>
{/if}