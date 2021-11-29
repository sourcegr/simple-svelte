<script>
    import Panel from "../../layout/Panel.svelte";
    import ButtonsPlace from "../../forms/ButtonsPlace.svelte";
    import Button from "../../forms/Button.svelte";
    import Spacer from "../../layout/Spacer.svelte";
</script>
<Panel>
    <slot slot="title">
        Panel Title
    </slot>

    <slot slot="body">
        Panels content
    </slot>
    <div slot="footer">
        <ButtonsPlace class="sre-pad sre-text-right">
            <Button class="transparent" on:click>Cancel</Button>
            <Button class="primary" on:click>OK</Button>
        </ButtonsPlace>
    </div>
</Panel>

<pre>{`<Panel>
    <slot slot="title">
        Panel Title
    </slot>

    <slot slot="body">
        Panels content
    </slot>
    <div slot="footer">
        <ButtonsPlace class="sre-pad sre-text-right">
            <Button class="transparent" on:click>Cancel</Button>
            <Button class="primary" on:click>OK</Button>
        </ButtonsPlace>
    </div>
</Panel>
`}</pre>

<Spacer/>
<Panel>
    <slot slot="title">
        About to close the browser...
    </slot>

    <slot slot="body">
        Do you want to save the file before closing?
    </slot>
    <div slot="footer">
        <ButtonsPlace class="sre-pad sre-text-right">
            <Button class="transparent sre-to-left" on:click>Cancel</Button>
            <Button class="primary" on:click>NO</Button>
            <Button class="danger" on:click>YES</Button>
        </ButtonsPlace>
    </div>
</Panel>

<pre>{`<Panel>
    <slot slot="title">
        About to close the browser...
    </slot>

    <slot slot="body">
        Do you want to save the file before closing?
    </slot>
    <div slot="footer">
        <ButtonsPlace class="sre-pad sre-text-right">
            <Button class="transparent sre-to-left" on:click>Cancel</Button>
            <Button class="primary" on:click>NO</Button>
            <Button class="danger" on:click>YES</Button>
        </ButtonsPlace>
    </div>
</Panel>
`}</pre>