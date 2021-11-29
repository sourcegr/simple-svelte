<script context="module">
    import {writable} from 'svelte/store';

    let breadCrumbArray = [];
    let breadcrumbAddTimeout;

    const {subscribe: subscribeBC, set: setBC} = writable(breadCrumbArray);
    const breadCrumb = {
        subscribe: subscribeBC,
        isCurrent(part) {
            return breadCrumbArray.indexOf(part) === breadCrumbArray.length-1;
        }
    };

    let matchedLevels = new Set();

    const resetMatchedLevels = level => {
        if (level == 0) {
            matchedLevels = new Set();
        }
    };

    const addBreadcrumb = function (text, link) {
        if (!text) {
            return;
        }
        if (breadcrumbAddTimeout) {
            clearTimeout(breadcrumbAddTimeout);
            breadcrumbAddTimeout = null;
        }
        const lnk = `/${link}`;
        const current = (lnk == document.location.pathname);

        breadCrumbArray.push({text, link:lnk, current });
        breadcrumbAddTimeout = setTimeout(setBreadcrumb, 50);
    };

    const setBreadcrumb = function () {
        setBC(breadCrumbArray);
    };
    const makeStoreValue = function (url) {
        const urlObj = new URL(url);

        const hash = urlObj.hash || null;
        const cleanPath = urlObj.pathname;//.substring(1);
        const parts = cleanPath.length > 0 ? cleanPath.split('/') : [];
        const query = urlObj.search ?
            JSON.parse('{"' + decodeURI(urlObj.search.substring(1)).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}') :
            null;
        // console.log(parts);
        breadCrumbArray = [];
        return {parts, hash, query, url: urlObj.pathname};
    };

    const makeUrl = where => document.location.origin +
        (where.startsWith('/') ? where : `/${st.parts.join('/')}/${where}`);

    const go = function (where, replaceState = false) {
        let url = makeUrl(where);
        if (replaceState) {
            window.history.replaceState(url, '', url);
        } else {
            window.history.pushState(url, '', url);
        }

        set(makeStoreValue(url));
    };

    window.addEventListener("popstate", function (event) {
        const where = event.state;
        set(makeStoreValue(where));
    });

    window.history.replaceState(document.location.href, '', document.location.href);
    let st = makeStoreValue(document.location.href);
    const {subscribe, set} = writable(st);

    const router = {
        url: document.location.pathname,
        subscribe,
        go: (where, params = {}) => (event = null) => {
            params.preventDefault && event?.preventDefault();
            params.stopPropagation && event?.stopPropagation();
            go(where);
        }
    };


    export {router, breadCrumb};
</script>


<script>
    import {getContext, setContext} from 'svelte';

    export let match = '',
        guard = null,
        exact = null,
        single = false,
        redir = '',
        breadcrumb = null;

    if (match.startsWith('/')) {
        match = match.substring(1);
    }

    let active,
        permissionError = false,
        data = {};

    const getLevelFunction = () => level;

    const getLevelCallback = getContext('getLevel') || getLevelFunction;

    let level = -1;
    level = getLevelCallback() + 1;


    setContext('getLevel', getLevelFunction);


    const check = function (store) {
        resetMatchedLevels(level);
        active = false;

        if (matchedLevels.has(level)) {
            return;
        }

        if (guard) {
            if (!checkPermissions(guard)) {
                permissionError = true;
                return;
            }
        }


        const len = store.parts.length;

        if (
            store.parts[level] == match ||
            (exact && len == level) ||
            (match == '*' && len > level)
        ) {
            active = true;
        }


        if (active) {
            // dd('   - match');
            data = {
                hash: store.hash,
                query: store.query
            };

            if (single) {
                matchedLevels.add(level);
            }
            if (match == '*') {
                data.star = store.parts[level];
            }

            let localPath;

            if (exact) {
                localPath = store.parts.slice(1, level + 1).join('/');
            } else {
                localPath = store.parts.slice(1, level + 1).join('/');
            }
            addBreadcrumb(breadcrumb, localPath);
        }
    };

    $: check($router);

</script>

{#if active}
    <slot router={data}/>
{/if}
{#if permissionError}
    <div>
        Access denied
    </div>
{/if}