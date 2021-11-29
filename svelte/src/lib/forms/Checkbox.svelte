<script>
    import {onDestroy, onMount, tick} from "svelte";

    export let form;
    export let value = false;
    export let checked = false;
    export let error = 'This needs to be checked';
    export let help = '';
    export let label = 'Checkbox';
    export let requireChecked = false;

    let hasError = false;
    let showError = false;
    let firstCheck = true;

    const check = (shouldUpdate = false, v) => {
        if (!form) {
            return;
        }

        if (!v) {
            v = value;
        }

        hasError = requireChecked && !checked;
        if (hasError) {
            showError = form.live && !firstCheck;
        } else {
            showError = false;
        }

        firstCheck = false;


        form.updateElementValidity(!hasError);
    };


    onMount(async () => {
        await tick();
        form.registerCheckCallback(check);
        check(false);
    });

    onDestroy(() => {
        form.unregisterCheckCallback(check);
    });


    $: check(false, checked)
</script>

<label>
    <input
            type="checkbox"
            bind:value
            bind:checked
    >
    { label || ''}
    {#if requireChecked} *{/if}
    {#if showError}
        <span class="sre-form-error sre-fw-n">{@html error}</span>
    {/if}
</label>