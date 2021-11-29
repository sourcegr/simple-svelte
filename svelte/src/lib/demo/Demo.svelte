<script>
    import Route, {breadCrumb} from '../Router/Router.svelte';
    import Panel from "../layout/Panel.svelte";
    import Row from "../Row.svelte";
    import Cell from "../Cell.svelte";
    import A from "../Router/A.svelte";
    import Button from "../forms/Button.svelte";
    import FormDemo from "./parts/FormDemo.svelte";
    import ButtonsDemo from "./parts/ButtonsDemo.svelte";
    import RowCellDemo from "./parts/RowCellDemo.svelte";
    import PanelDemo from "./parts/PanelDemo.svelte";
    import ButtonsPlaceDemo from "./parts/ButtonsPlaceDemo.svelte";

    let btnDisabled = false;
</script>

<div class="sre-container demo">
    <div>
        {#each $breadCrumb as item}
            {#if item.current}
                {item.text}
            {:else}
                <A href={ item.link}>{item.text}</A> /&nbsp;
            {/if}

        {/each}
    </div>

    <Row>
        <Cell style="align-self: flex-start">
            <Panel plain nopad>
                <div slot="title">Menu</div>
                <div slot="body" class="sre-childs-block">
                    <A useActive class="sre-small-pad" href="/demo/panel">Panel</A>
                    <A useActive class="sre-small-pad" href="/demo/rowcell">RowCell</A>
                    <A useActive class="sre-small-pad" href="/demo/buttons">Buttons</A>
                    <A useActive class="sre-small-pad" href="/demo/form">Form</A>
                    <A useActive class="sre-small-pad" href="/demo/buttons-place">BtnPlace</A>
                </div>
            </Panel>
        </Cell>

        <Cell size="1" block style="align-self: flex-start">
            <Route single match="panel" breadcrumb="panels">
                <PanelDemo/>
            </Route>


            <Route single match="rowcell" breadcrumb="rowcell">
                <RowCellDemo/>
            </Route>

            <Route single match="buttons" breadcrumb="buttons">
                <ButtonsDemo />
            </Route>

            <Route single match="form" breadcrumb="form">
                <FormDemo/>
            </Route>

            <Route single match="buttons-place" breadcrumb="Buttons Place">
                <ButtonsPlaceDemo/>
            </Route>

            <Route single match="*" let:router>
                {router.star}
            </Route>
        </Cell>

    </Row>
</div>


<style>
    .demo :global(pre) {
        padding:20px;
        background:cornsilk;
        font-size: 14px;
    }
</style>