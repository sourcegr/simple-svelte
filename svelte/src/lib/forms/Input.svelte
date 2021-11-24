<script>
    import {parseRules, validateItem} from './Form.svelte';

    let element,
        classNames = '',
        error = null,
        label = '',
        help = '',
        hasFocus = false,
        form = null,
        value = '',
        multiline = false;

    export {classNames as class, error, label, help, value, hasFocus, form, multiline};


    let hasError = false;
    let rules = {};
    let errorText = error;
    let displayError = false;

    const check = v => {
        if (!form) return;
        const err = validateItem(rules, v);

        if (err) {
            hasError = true;
            errorText = error || err;
        } else {
            hasError = false;
        }

        if (form.live) {
            setTimeout(() => {
                form.validateForm(false);
            });
            displayError = hasError;
        }
    };


    if (hasFocus) {
        setTimeout(() => {
            element.focus();
        });
    }

    setTimeout(() => {
        check(value);
    });


    $: rules = parseRules($$props);
    $: check(value);
</script>


<div class="label">
    { label || ''}
    {#if rules.required} *{/if}
    {#if displayError}
        <span class="sre-form-error sre-fw-n">{@html errorText}</span>
    {/if}
</div>

{#if multiline}
    <textarea
            bind:value
            bind:this={element}
            data-sre-control
            data-valid="{ !hasError }"
            class="sre-form-item { classNames }"
            class:sre-input-error={ displayError }

    ></textarea>
{:else}
    <input
            type="text"
            bind:value
            bind:this={element}
            data-sre-control
            data-valid="{ !hasError }"
            class="sre-form-item { classNames }"
            class:sre-input-error={ displayError }

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