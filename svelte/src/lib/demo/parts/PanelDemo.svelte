<script>
    import Panel from "../../layout/Panel.svelte";
    import Spacer from "../../layout/Spacer.svelte";
    import Row from "../../Row.svelte";
    import Cell from "../../Cell.svelte";
</script>


<Row>
    <Cell>
        <div>
            <Panel rolls>
                <slot slot="title">i am a panel</slot>
                <slot slot="body">And this is my content. I can be rolled up/down</slot>
                <div class="sre-error" slot="footer">This is the footer. The slot itself is not padded or styled, but you can add the class you want</div>
            </Panel>
            <pre>
    {`<Panel rolls>
    <slot slot="title">
        i am a panel
    </slot>
    <slot slot="body">
        And this is my content. I can be rolled up/down
    </slot>
    <div class="sre-error" slot="footer">
        This is the footer. The slot itself
        is not padded or styled,
        but you can add the class you want
    </div>
</Panel>`}
</pre>
            <Spacer/>


            <Panel plain rolls>
                <slot slot="title">i am a clickable panel</slot>
                <slot slot="body">
                    And I have a dark BG
                </slot>
            </Panel>
            <pre>
    {`
<Panel plain rolls>
    <slot slot="title">
        i am a clickable panel
    </slot>
    <slot slot="body">
        And I have a dark BG
    </slot>
</Panel>`}
</pre>
            <Spacer/>


            <Panel rolled rolls>
                <slot slot="title">i am a panel (hoverable!). Click me</slot>
                <slot slot="body">
                    but i start as closed
                </slot>
            </Panel>
            <pre>
    {`<Panel rolled rolls>
    <slot slot="title">
        i am a panel (hoverable!). Click me
    </slot>
    <slot slot="body">
        but i start as closed
    </slot>
</Panel>`}
</pre>
            <Spacer/>


            <Panel>
                <slot slot="title">i am a panel and I have no content! Essentially, I am a title</slot>
            </Panel>
            <pre>
    {`<Panel>
    <slot slot="title">
        i am a panel and I have no content!
        Essentially, I am a title
    </slot>
</Panel>`}
</pre>
            <Spacer/>


            <Panel>
                <slot slot="body" class="lalala">This is a panel with no title. It is essentially a bordered box
                    with a
                    border-radius and a margin
                </slot>
            </Panel>
            <pre>
    {`<Panel>
    <slot slot="body" class="lalala">
        This is a panel with no title. It is essentially
        a bordered box with a
        border-radius and a margin
    </slot>
</Panel>`}
</pre>
            <Spacer/>


            <Panel nopad>
                <slot slot="title">i am a panel</slot>
                <slot slot="body">with a body that has nopad</slot>
            </Panel>
            <pre>
    {`<Panel nopad>
    <slot slot="title">i am a panel</slot>
    <slot slot="body">with a body that has nopad</slot>
</Panel>`}
</pre>
        </div>
    </Cell>
    <Cell size="4">
        <div>
            <Panel>
                <slot slot="title">Attrs</slot>
                <slot slot="body">
                    &bull; <tt>class</tt> = ''<br>
                    &bull; <tt>rolls</tt> = false<br>
                    &bull; <tt>rolled</tt> = false<br>
                    &bull; <tt>style</tt> = ''<br>
                    &bull; <tt>nopad</tt> = false<br>
                    &bull; <tt>plain</tt> = false
                </slot>
            </Panel>
            <Panel>
                <slot slot="title">Slots</slot>
                <slot slot="body">
                    &bull; title<br>
                    &bull; body<br>
                    &bull; footer<br>
                </slot>
            </Panel>

        </div>
    </Cell>
</Row>