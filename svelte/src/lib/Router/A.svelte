<script>
    import {router} from './Router.svelte';

    let href = '#';
    let natural = false;
    let useActive = null;
    let useExactActive = null;
    let classNames = '';
    let isAllowed = true;
    let visible = () => true;

    export {visible, href, natural, useActive, useExactActive, classNames as class};

    let activeClass = '';

    const check = (store, callback) => {
        isAllowed = true;
        if (callback) {
            isAllowed = callback();
            if (!isAllowed) {
                return;
            }
        }

        activeClass = '';

        if (useExactActive !== null && store.url == href) {
            activeClass = useExactActive === true ? 'link-active' : useActive;
            return;
        }

        if (useActive !== null && store.url.startsWith(href)) {
            activeClass = useActive === true ? 'link-active' : useActive;
        }

    };

    $: check($router, visible);
</script>


{#if isAllowed}
    {#if natural}
        <a {href} class="{activeClass} {classNames}" on:click>
            <slot/>
        </a>
    {:else}
        <a {href}
           class="{activeClass} {classNames}"
           on:click="{ router.go(href, {preventDefault:true}) }"
           on:click>
            <slot/>
        </a>
    {/if}
{/if}