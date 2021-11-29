<script>
    import Route from "./lib/Router/Router.svelte";
    import Demo from "./lib/demo/Demo.svelte";
</script>

<Route match="/" breadcrumb="Arxh">
    <Route match="demo" breadcrumb="demo">
        <Demo />
    </Route>
</Route>

