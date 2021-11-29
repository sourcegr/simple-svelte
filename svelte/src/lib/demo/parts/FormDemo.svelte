<script>

    import Panel from "../../layout/Panel.svelte";
    import Form from "../../forms/Form.svelte";
    import Input from "../../forms/Input.svelte";
    import Button from "../../forms/Button.svelte";
    import Checkbox from "../../forms/Checkbox.svelte";
    import ButtonsPlace from "../../forms/ButtonsPlace.svelte";
    import Spacer from "../../layout/Spacer.svelte";

    let formIsValid;
    let form;

    const submitForm = () => {
        const isValid = form.checkValidity();
    }

</script>

<Panel>
    <slot slot="title">
        The following form is
        {#if !formIsValid}
            <span class="sre-error">NOT</span>
        {/if}
        valid
    </slot>

    <slot slot="body">
        <Form bind:this={form} bind:valid={ formIsValid }>
            <Input class="sre-block" {form} label="Contact's First name" error="please!"
                   help="Please enter the first name" required/>

            <Input multiline class="sre-block" {form} label="Contact's data. Please all"
                   error="Data is required" help="Please enter the clients data. Dont be afraid"
                   required/>

            <Spacer/>
            <Checkbox
                    {form}
                    requireChecked
                    label="Check to receive newsletter"
                    error="You need to accept the terms"/>
        </Form>


    </slot>
    <div slot="footer">
        <ButtonsPlace class="sre-pad sre-text-right">
            <Button class="primary" on:click={ submitForm }>Submit</Button>
        </ButtonsPlace>
    </div>
</Panel>

<pre>{`<Panel>
    <slot slot="title">
        The following form is
        {#if !formIsValid}
            <span class="sre-error">NOT</span>
        {/if}
        valid
    </slot>

    <slot slot="body">
        <Form bind:this={form} bind:valid={ formIsValid }>
            <Input class="sre-block" {form} label="Contact's First name" error="please!"
                   help="Please enter the first name" required/>

            <Input multiline class="sre-block" {form} label="Contact's data. Please all"
                   error="Data is required" help="Please enter the clients data. Dont be afraid"
                   required/>
            <Spacer/>
            <Checkbox
                    {form}
                    requireChecked
                    label="Check to receive newsletter"
                    error="You need to accept the terms"/>
        </Form>


    </slot>
    <div slot="footer">
        <ButtonsPlace class="sre-pad sre-text-right">
            <Button class="primary" on:click={ submitForm }>Submit</Button>
        </ButtonsPlace>
    </div>
</Panel>`}</pre>