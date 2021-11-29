<script>
    let classList = '';
    export {classList as class};
</script>

<div class="btn-place {classList}">
    <slot/>
</div>


<style>
    .btn-place {
        background: var(--panel-light-bg);
        border-top: 1px solid var(--panel-border-light);
    }
</style>