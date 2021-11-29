<script>
    let classList = 'normal';
    export {classList as class};

    export let disabled = null;
    export let block = false;

</script>

<button {disabled} class={classList} class:block on:click>
    <slot/>
</button>


<style>
    button {
        font-size: 16px;
        padding: var(--panel-half-pad) var(--panel-pad);
        width: auto;
        height: auto;
        border-style: none;
        border: 1px solid rgba(0, 0, 0, .15);
        border-radius: var(--border-radius-small);
        transition: var(--transition-default);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }

    button.block {
        width: 100%;
    }

    button:not([disabled]):not(.aslink):hover {
        filter: brightness(140%);
    }

    button[disabled] {
        color: #ccc;
        cursor: not-allowed;
    }

    .success {
        color: #fff;
        background: green;
    }

    .danger {
        color: #fff;
        background: red;
    }

    .normal, .primary {
        color: #fff;
        background: #2196f3;
    }

    .transparent {
        background: #fff0;
        color: #000;
    }
    .aslink {
        background: #fff0;
        color: var(--link-color);
        border: 1px solid #0000;
    }
    .aslink:not([disabled]):hover {
        color: var(--link-hover-color);
        text-decoration: underline;
    }
</style>