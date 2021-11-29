<script>
    export let rolls = false;
    export let rolled = false;

    export let style = '';
    export let nopad = false;

    export let plain = false;

    let className = '';
    export {className as class};


    const roll = () => rolls && (rolled = !rolled);
</script>

<div class:nopad class:rolled class:plain class:rolls class="panel { className }" { style }>
    <header on:click={ roll }>
        <slot name="title"></slot>
    </header>

    <div class="body">
        <slot name="body"/>
    </div>

    <slot name="footer"/>
</div>

<style>
    .panel {
        transition: .3s;
        margin: var(--panel-pad) var(--panel-half-pad);
        border: 1px solid var(--panel-border);
        border-radius: var(--border-radius-small);
        width: auto;
    }

    .panel.rolls.rolled:hover {
        box-shadow: var(--hovered-shadow)
    }

    .panel > * {
        padding: var(--panel-pad);
    }

    .panel > header {
        background: #fff;
        transition: .3s;
        font-size: var(--fs-big);
        font-weight: bold;
        border-bottom: 1px solid #0000;
        text-transform: uppercase;
    }

    .panel > header:empty {
        display: none;
    }


    .panel.rolls > header {
        cursor: pointer;
        position: relative;
        border-bottom: 1px solid var(--panel-border);
    }

    .panel.rolls > header:hover, .panel:not(.rolls) > header, .panel.plain > header {
        background: var(--panel-dark-bg);
        border-bottom: 1px solid var(--panel-border-light);
    }

    .panel.rolls > header:after {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        content: "-";
    }

    .panel.rolls.rolled > header:after {
        content: "+";
    }

    .panel.rolled > .body, .panel > .body:empty {
        height: 0;
        padding: 0;
        overflow: hidden;
    }

    .panel.nopad .body {
        padding: 0;
    }
</style>