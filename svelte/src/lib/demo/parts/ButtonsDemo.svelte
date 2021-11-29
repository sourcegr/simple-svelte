<script>

    import Button from "../../forms/Button.svelte";
    import Panel from "../../layout/Panel.svelte";
    import Spacer from "../../layout/Spacer.svelte";

    let btnDisabled = false;

</script>


<Panel>
    <slot slot="title">Buttons</slot>
    <slot slot="body">
        <div class="sre-pad">
            <label>
                <input type="checkbox" bind:checked={btnDisabled}> Disabled state
            </label>
        </div>
        <pre>{`<Button class="normal|success|danger|transparent|aslink">button text</Button>`}</pre>
        <Button disabled={ btnDisabled } class="normal">normal (no class)</Button>

        <Button disabled={ btnDisabled } class="success">success</Button>

        <Button disabled={ btnDisabled } class="danger">danger</Button>

        <Button disabled={ btnDisabled } class="transparent">transparent</Button>
        <Button disabled={ btnDisabled } class="aslink">As a link</Button>


        <Spacer/>
        - Add block attribute to make it block<br>
        <pre>{`<Button class="normal|success|danger|transparent|aslink">button text</Button>`}</pre>
        <Button disabled={ btnDisabled } block class="normal">normal (no class)</Button>
        <hr>
        <Button disabled={ btnDisabled } block class="success">success</Button>
        <hr>
        <Button disabled={ btnDisabled } block class="danger">danger</Button>
        <hr>
        <Button disabled={ btnDisabled } block class="transparent">transparent</Button>
        <br>
        <Button disabled={ btnDisabled } block class="aslink">As a link</Button>
    </slot>
</Panel>