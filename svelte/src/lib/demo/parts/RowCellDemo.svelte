<script>
    import Panel from "../../layout/Panel.svelte";
    import Row from "../../Row.svelte";
    import Cell from "../../Cell.svelte";
</script>
<Panel nopad>
    <slot slot="title">Rows/cells</slot>
    <slot slot="body">

        <Row>
            <Cell size="none" class="sre-pad">
                2
            </Cell>
            <Cell size="2" style="background: orange" class="sre-margin">
                Other cell contents<br>
                size=2<br>
                It is double than the one on the right and is also margined
            </Cell>
            <Cell size="1" style="background: yellow">
                One more cell<br>
                size=1<br>
                It is half the size of the one on the right
            </Cell>
            <Cell size="2">
                <div>
                    You can add any classNames<br>
                    and any style you want<br>
                    in the <code>Row</code> and <code>Cell</code>
                </div>
            </Cell>
        </Row>

<pre>{`<Row>
    <Cell size="none" class="sre-pad">
        2
    </Cell>
    <Cell size="2" style="background: orange" class="sre-margin">
        Other cell contents<br>
        size=2<br>
        It is double than the one on the right and is also margined
    </Cell>
    <Cell size="1" style="background: yellow">
        One more cell<br>
        size=1<br>
        It is half the size of the one on the right
    </Cell>
    <Cell size="2">
        <div>
            You can add any classNames<br>
            and any style you want<br>
            in the <code>Row</code> and <code>Cell</code>
        </div>
    </Cell>
</Row>`}
</pre>
    </slot>
</Panel>