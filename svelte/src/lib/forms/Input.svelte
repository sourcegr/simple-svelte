<script>
    import {parseRules, validateItem} from './Form.svelte';
    import {onDestroy, onMount, tick} from "svelte";


    export let error = null;
    export let label = '';
    export let help = '';
    export let hasFocus = false;
    export let form = null;
    export let value = '';
    export let multiline = false;

    let classNames = '';
    export {classNames as class};

    let element;
    let rules = {};

    let errorText = '';
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

        const err = validateItem(rules, v);
        errorText = err ? (error || err) : '';

        hasError = !!err;

        if (hasError) {
            showError = form.live && !firstCheck;
        } else {
            showError = false;
        }
        firstCheck = false;

        form.updateElementValidity(!err);
    };


    onMount(async () => {
        await tick();
        if (hasFocus) {
            element.focus();
        }
        form.registerCheckCallback(check);

        check(false); // initial check
    });

    onDestroy(() => {
        form.unregisterCheckCallback(check);
    });


    $: rules = parseRules($$props);
    $: check(false, value)
</script>


<div class="label">
    { label || ''}
    {#if rules.required} *{/if}
    {#if showError}
        <span class="sre-form-error sre-fw-n">{@html errorText}</span>
    {/if}
</div>

{#if multiline}
    <textarea
            bind:value
            bind:this={element}
            class="sre-form-item { classNames }"
            class:sre-input-error={ showError }

    ></textarea>
{:else}
    <input
            type="text"
            bind:value
            bind:this={element}
            class="sre-form-item { classNames }"
            class:sre-input-error={ showError }

    />
{/if}
<div class="sre-form-help">
    {@html help}
</div>


<style>
    .label {
        margin-top: 20px;
    }
</style>