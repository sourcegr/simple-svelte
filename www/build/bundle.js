var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe$1(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe$1(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.2' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    /* src/lib/Router/Router.svelte generated by Svelte v3.44.2 */
    const file$g = "src/lib/Router/Router.svelte";
    const get_default_slot_changes$5 = dirty => ({ router: dirty & /*data*/ 4 });
    const get_default_slot_context$5 = ctx => ({ router: /*data*/ ctx[2] });

    // (178:0) {#if active}
    function create_if_block_1$3(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[11].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[10], get_default_slot_context$5);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, data*/ 1028)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[10],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[10])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[10], dirty, get_default_slot_changes$5),
    						get_default_slot_context$5
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(178:0) {#if active}",
    		ctx
    	});

    	return block;
    }

    // (181:0) {#if permissionError}
    function create_if_block$5(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "Access denied";
    			add_location(div, file$g, 181, 4, 4631);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(181:0) {#if permissionError}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$h(ctx) {
    	let t;
    	let if_block1_anchor;
    	let current;
    	let if_block0 = /*active*/ ctx[0] && create_if_block_1$3(ctx);
    	let if_block1 = /*permissionError*/ ctx[1] && create_if_block$5(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*active*/ ctx[0]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*active*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1$3(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t.parentNode, t);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*permissionError*/ ctx[1]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block$5(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$h.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    let breadCrumbArray = [];
    let breadcrumbAddTimeout;
    const { subscribe: subscribeBC, set: setBC } = writable(breadCrumbArray);

    const breadCrumb = {
    	subscribe: subscribeBC,
    	isCurrent(part) {
    		return breadCrumbArray.indexOf(part) === breadCrumbArray.length - 1;
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
    	const current = lnk == document.location.pathname;
    	breadCrumbArray.push({ text, link: lnk, current });
    	breadcrumbAddTimeout = setTimeout(setBreadcrumb, 50);
    };

    const setBreadcrumb = function () {
    	setBC(breadCrumbArray);
    };

    const makeStoreValue = function (url) {
    	const urlObj = new URL(url);
    	const hash = urlObj.hash || null;
    	const cleanPath = urlObj.pathname; //.substring(1);
    	const parts = cleanPath.length > 0 ? cleanPath.split('/') : [];

    	const query = urlObj.search
    	? JSON.parse('{"' + decodeURI(urlObj.search.substring(1)).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}')
    	: null;

    	// console.log(parts);
    	breadCrumbArray = [];

    	return { parts, hash, query, url: urlObj.pathname };
    };

    const makeUrl = where => document.location.origin + (where.startsWith('/')
    ? where
    : `/${st.parts.join('/')}/${where}`);

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
    const { subscribe, set } = writable(st);

    const router = {
    	url: document.location.pathname,
    	subscribe,
    	go: (where, params = {}) => (event = null) => {
    		params.preventDefault && event?.preventDefault();
    		params.stopPropagation && event?.stopPropagation();
    		go(where);
    	}
    };

    function instance$h($$self, $$props, $$invalidate) {
    	let $router,
    		$$unsubscribe_router = noop;

    	validate_store(router, 'router');
    	component_subscribe($$self, router, $$value => $$invalidate(9, $router = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_router());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, ['default']);
    	let { match = '', guard = null, exact = null, single = false, redir = '', breadcrumb = null } = $$props;

    	if (match.startsWith('/')) {
    		match = match.substring(1);
    	}

    	let active, permissionError = false, data = {};
    	const getLevelFunction = () => level;
    	const getLevelCallback = getContext('getLevel') || getLevelFunction;
    	let level = -1;
    	level = getLevelCallback() + 1;
    	setContext('getLevel', getLevelFunction);

    	const check = function (store) {
    		resetMatchedLevels(level);
    		$$invalidate(0, active = false);

    		if (matchedLevels.has(level)) {
    			return;
    		}

    		if (guard) {
    			if (!checkPermissions(guard)) {
    				$$invalidate(1, permissionError = true);
    				return;
    			}
    		}

    		const len = store.parts.length;

    		if (store.parts[level] == match || exact && len == level || match == '*' && len > level) {
    			$$invalidate(0, active = true);
    		}

    		if (active) {
    			// dd('   - match');
    			$$invalidate(2, data = { hash: store.hash, query: store.query });

    			if (single) {
    				matchedLevels.add(level);
    			}

    			if (match == '*') {
    				$$invalidate(2, data.star = store.parts[level], data);
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

    	const writable_props = ['match', 'guard', 'exact', 'single', 'redir', 'breadcrumb'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('match' in $$props) $$invalidate(3, match = $$props.match);
    		if ('guard' in $$props) $$invalidate(4, guard = $$props.guard);
    		if ('exact' in $$props) $$invalidate(5, exact = $$props.exact);
    		if ('single' in $$props) $$invalidate(6, single = $$props.single);
    		if ('redir' in $$props) $$invalidate(7, redir = $$props.redir);
    		if ('breadcrumb' in $$props) $$invalidate(8, breadcrumb = $$props.breadcrumb);
    		if ('$$scope' in $$props) $$invalidate(10, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		writable,
    		breadCrumbArray,
    		breadcrumbAddTimeout,
    		subscribeBC,
    		setBC,
    		breadCrumb,
    		matchedLevels,
    		resetMatchedLevels,
    		addBreadcrumb,
    		setBreadcrumb,
    		makeStoreValue,
    		makeUrl,
    		go,
    		st,
    		subscribe,
    		set,
    		router,
    		getContext,
    		setContext,
    		match,
    		guard,
    		exact,
    		single,
    		redir,
    		breadcrumb,
    		active,
    		permissionError,
    		data,
    		getLevelFunction,
    		getLevelCallback,
    		level,
    		check,
    		$router
    	});

    	$$self.$inject_state = $$props => {
    		if ('match' in $$props) $$invalidate(3, match = $$props.match);
    		if ('guard' in $$props) $$invalidate(4, guard = $$props.guard);
    		if ('exact' in $$props) $$invalidate(5, exact = $$props.exact);
    		if ('single' in $$props) $$invalidate(6, single = $$props.single);
    		if ('redir' in $$props) $$invalidate(7, redir = $$props.redir);
    		if ('breadcrumb' in $$props) $$invalidate(8, breadcrumb = $$props.breadcrumb);
    		if ('active' in $$props) $$invalidate(0, active = $$props.active);
    		if ('permissionError' in $$props) $$invalidate(1, permissionError = $$props.permissionError);
    		if ('data' in $$props) $$invalidate(2, data = $$props.data);
    		if ('level' in $$props) level = $$props.level;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$router*/ 512) {
    			check($router);
    		}
    	};

    	return [
    		active,
    		permissionError,
    		data,
    		match,
    		guard,
    		exact,
    		single,
    		redir,
    		breadcrumb,
    		$router,
    		$$scope,
    		slots
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$h, create_fragment$h, safe_not_equal, {
    			match: 3,
    			guard: 4,
    			exact: 5,
    			single: 6,
    			redir: 7,
    			breadcrumb: 8
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$h.name
    		});
    	}

    	get match() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set match(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get guard() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set guard(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exact() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exact(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get single() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set single(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get redir() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set redir(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get breadcrumb() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set breadcrumb(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/lib/layout/Panel.svelte generated by Svelte v3.44.2 */

    const file$f = "src/lib/layout/Panel.svelte";
    const get_footer_slot_changes = dirty => ({});
    const get_footer_slot_context = ctx => ({});
    const get_body_slot_changes = dirty => ({});
    const get_body_slot_context = ctx => ({});
    const get_title_slot_changes = dirty => ({});
    const get_title_slot_context = ctx => ({});

    function create_fragment$g(ctx) {
    	let div1;
    	let header;
    	let t0;
    	let div0;
    	let t1;
    	let div1_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const title_slot_template = /*#slots*/ ctx[8].title;
    	const title_slot = create_slot(title_slot_template, ctx, /*$$scope*/ ctx[7], get_title_slot_context);
    	const body_slot_template = /*#slots*/ ctx[8].body;
    	const body_slot = create_slot(body_slot_template, ctx, /*$$scope*/ ctx[7], get_body_slot_context);
    	const footer_slot_template = /*#slots*/ ctx[8].footer;
    	const footer_slot = create_slot(footer_slot_template, ctx, /*$$scope*/ ctx[7], get_footer_slot_context);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			header = element("header");
    			if (title_slot) title_slot.c();
    			t0 = space();
    			div0 = element("div");
    			if (body_slot) body_slot.c();
    			t1 = space();
    			if (footer_slot) footer_slot.c();
    			attr_dev(header, "class", "svelte-hdqhy");
    			add_location(header, file$f, 17, 4, 379);
    			attr_dev(div0, "class", "body svelte-hdqhy");
    			add_location(div0, file$f, 21, 4, 460);
    			attr_dev(div1, "class", div1_class_value = "panel " + /*className*/ ctx[5] + " svelte-hdqhy");
    			attr_dev(div1, "style", /*style*/ ctx[2]);
    			toggle_class(div1, "nopad", /*nopad*/ ctx[3]);
    			toggle_class(div1, "rolled", /*rolled*/ ctx[0]);
    			toggle_class(div1, "plain", /*plain*/ ctx[4]);
    			toggle_class(div1, "rolls", /*rolls*/ ctx[1]);
    			add_location(div1, file$f, 16, 0, 282);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, header);

    			if (title_slot) {
    				title_slot.m(header, null);
    			}

    			append_dev(div1, t0);
    			append_dev(div1, div0);

    			if (body_slot) {
    				body_slot.m(div0, null);
    			}

    			append_dev(div1, t1);

    			if (footer_slot) {
    				footer_slot.m(div1, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(header, "click", /*roll*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (title_slot) {
    				if (title_slot.p && (!current || dirty & /*$$scope*/ 128)) {
    					update_slot_base(
    						title_slot,
    						title_slot_template,
    						ctx,
    						/*$$scope*/ ctx[7],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
    						: get_slot_changes(title_slot_template, /*$$scope*/ ctx[7], dirty, get_title_slot_changes),
    						get_title_slot_context
    					);
    				}
    			}

    			if (body_slot) {
    				if (body_slot.p && (!current || dirty & /*$$scope*/ 128)) {
    					update_slot_base(
    						body_slot,
    						body_slot_template,
    						ctx,
    						/*$$scope*/ ctx[7],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
    						: get_slot_changes(body_slot_template, /*$$scope*/ ctx[7], dirty, get_body_slot_changes),
    						get_body_slot_context
    					);
    				}
    			}

    			if (footer_slot) {
    				if (footer_slot.p && (!current || dirty & /*$$scope*/ 128)) {
    					update_slot_base(
    						footer_slot,
    						footer_slot_template,
    						ctx,
    						/*$$scope*/ ctx[7],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
    						: get_slot_changes(footer_slot_template, /*$$scope*/ ctx[7], dirty, get_footer_slot_changes),
    						get_footer_slot_context
    					);
    				}
    			}

    			if (!current || dirty & /*className*/ 32 && div1_class_value !== (div1_class_value = "panel " + /*className*/ ctx[5] + " svelte-hdqhy")) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if (!current || dirty & /*style*/ 4) {
    				attr_dev(div1, "style", /*style*/ ctx[2]);
    			}

    			if (dirty & /*className, nopad*/ 40) {
    				toggle_class(div1, "nopad", /*nopad*/ ctx[3]);
    			}

    			if (dirty & /*className, rolled*/ 33) {
    				toggle_class(div1, "rolled", /*rolled*/ ctx[0]);
    			}

    			if (dirty & /*className, plain*/ 48) {
    				toggle_class(div1, "plain", /*plain*/ ctx[4]);
    			}

    			if (dirty & /*className, rolls*/ 34) {
    				toggle_class(div1, "rolls", /*rolls*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(title_slot, local);
    			transition_in(body_slot, local);
    			transition_in(footer_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(title_slot, local);
    			transition_out(body_slot, local);
    			transition_out(footer_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (title_slot) title_slot.d(detaching);
    			if (body_slot) body_slot.d(detaching);
    			if (footer_slot) footer_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$g($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Panel', slots, ['title','body','footer']);
    	let { rolls = false } = $$props;
    	let { rolled = false } = $$props;
    	let { style = '' } = $$props;
    	let { nopad = false } = $$props;
    	let { plain = false } = $$props;
    	let { class: className = '' } = $$props;
    	const roll = () => rolls && $$invalidate(0, rolled = !rolled);
    	const writable_props = ['rolls', 'rolled', 'style', 'nopad', 'plain', 'class'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Panel> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('rolls' in $$props) $$invalidate(1, rolls = $$props.rolls);
    		if ('rolled' in $$props) $$invalidate(0, rolled = $$props.rolled);
    		if ('style' in $$props) $$invalidate(2, style = $$props.style);
    		if ('nopad' in $$props) $$invalidate(3, nopad = $$props.nopad);
    		if ('plain' in $$props) $$invalidate(4, plain = $$props.plain);
    		if ('class' in $$props) $$invalidate(5, className = $$props.class);
    		if ('$$scope' in $$props) $$invalidate(7, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		rolls,
    		rolled,
    		style,
    		nopad,
    		plain,
    		className,
    		roll
    	});

    	$$self.$inject_state = $$props => {
    		if ('rolls' in $$props) $$invalidate(1, rolls = $$props.rolls);
    		if ('rolled' in $$props) $$invalidate(0, rolled = $$props.rolled);
    		if ('style' in $$props) $$invalidate(2, style = $$props.style);
    		if ('nopad' in $$props) $$invalidate(3, nopad = $$props.nopad);
    		if ('plain' in $$props) $$invalidate(4, plain = $$props.plain);
    		if ('className' in $$props) $$invalidate(5, className = $$props.className);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [rolled, rolls, style, nopad, plain, className, roll, $$scope, slots];
    }

    class Panel extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {
    			rolls: 1,
    			rolled: 0,
    			style: 2,
    			nopad: 3,
    			plain: 4,
    			class: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Panel",
    			options,
    			id: create_fragment$g.name
    		});
    	}

    	get rolls() {
    		throw new Error("<Panel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rolls(value) {
    		throw new Error("<Panel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rolled() {
    		throw new Error("<Panel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rolled(value) {
    		throw new Error("<Panel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Panel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Panel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nopad() {
    		throw new Error("<Panel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nopad(value) {
    		throw new Error("<Panel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get plain() {
    		throw new Error("<Panel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set plain(value) {
    		throw new Error("<Panel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Panel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Panel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/lib/Row.svelte generated by Svelte v3.44.2 */

    const file$e = "src/lib/Row.svelte";

    function create_fragment$f(ctx) {
    	let div;
    	let div_class_value;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "style", /*style*/ ctx[1]);
    			attr_dev(div, "class", div_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-1cd83ib"));
    			add_location(div, file$e, 6, 0, 88);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*style*/ 2) {
    				attr_dev(div, "style", /*style*/ ctx[1]);
    			}

    			if (!current || dirty & /*className*/ 1 && div_class_value !== (div_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-1cd83ib"))) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Row', slots, ['default']);
    	let { class: className = '' } = $$props;
    	let { style = "" } = $$props;
    	const writable_props = ['class', 'style'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Row> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('class' in $$props) $$invalidate(0, className = $$props.class);
    		if ('style' in $$props) $$invalidate(1, style = $$props.style);
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ className, style });

    	$$self.$inject_state = $$props => {
    		if ('className' in $$props) $$invalidate(0, className = $$props.className);
    		if ('style' in $$props) $$invalidate(1, style = $$props.style);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [className, style, $$scope, slots];
    }

    class Row extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, { class: 0, style: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Row",
    			options,
    			id: create_fragment$f.name
    		});
    	}

    	get class() {
    		throw new Error("<Row>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Row>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Row>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Row>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/lib/Cell.svelte generated by Svelte v3.44.2 */

    const file$d = "src/lib/Cell.svelte";

    function create_fragment$e(ctx) {
    	let div;
    	let div_style_value;
    	let div_class_value;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[5].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "style", div_style_value = "flex:" + /*size*/ ctx[3] + ";" + /*style*/ ctx[1]);
    			attr_dev(div, "class", div_class_value = "cell " + /*className*/ ctx[0] + " svelte-j5fiej");
    			toggle_class(div, "block", /*block*/ ctx[2]);
    			add_location(div, file$d, 9, 0, 147);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 16)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[4],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[4])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[4], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*size, style*/ 10 && div_style_value !== (div_style_value = "flex:" + /*size*/ ctx[3] + ";" + /*style*/ ctx[1])) {
    				attr_dev(div, "style", div_style_value);
    			}

    			if (!current || dirty & /*className*/ 1 && div_class_value !== (div_class_value = "cell " + /*className*/ ctx[0] + " svelte-j5fiej")) {
    				attr_dev(div, "class", div_class_value);
    			}

    			if (dirty & /*className, block*/ 5) {
    				toggle_class(div, "block", /*block*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block_1;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Cell', slots, ['default']);
    	let { class: className = '' } = $$props;
    	let { style = "" } = $$props;
    	let { block = false } = $$props;
    	let { size = "none" } = $$props;
    	const writable_props = ['class', 'style', 'block', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Cell> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('class' in $$props) $$invalidate(0, className = $$props.class);
    		if ('style' in $$props) $$invalidate(1, style = $$props.style);
    		if ('block' in $$props) $$invalidate(2, block = $$props.block);
    		if ('size' in $$props) $$invalidate(3, size = $$props.size);
    		if ('$$scope' in $$props) $$invalidate(4, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ className, style, block, size });

    	$$self.$inject_state = $$props => {
    		if ('className' in $$props) $$invalidate(0, className = $$props.className);
    		if ('style' in $$props) $$invalidate(1, style = $$props.style);
    		if ('block' in $$props) $$invalidate(2, block = $$props.block);
    		if ('size' in $$props) $$invalidate(3, size = $$props.size);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [className, style, block, size, $$scope, slots];
    }

    class Cell extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, { class: 0, style: 1, block: 2, size: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Cell",
    			options,
    			id: create_fragment$e.name
    		});
    	}

    	get class() {
    		throw new Error("<Cell>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Cell>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Cell>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Cell>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get block() {
    		throw new Error("<Cell>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set block(value) {
    		throw new Error("<Cell>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Cell>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Cell>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/lib/Router/A.svelte generated by Svelte v3.44.2 */
    const file$c = "src/lib/Router/A.svelte";

    // (42:0) {#if isAllowed}
    function create_if_block$4(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$2, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*natural*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(42:0) {#if isAllowed}",
    		ctx
    	});

    	return block;
    }

    // (47:4) {:else}
    function create_else_block$2(ctx) {
    	let a;
    	let a_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], null);

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			attr_dev(a, "href", /*href*/ ctx[0]);
    			attr_dev(a, "class", a_class_value = "" + (/*activeClass*/ ctx[4] + " " + /*classNames*/ ctx[2]));
    			add_location(a, file$c, 47, 8, 1105);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						a,
    						"click",
    						function () {
    							if (is_function(router.go(/*href*/ ctx[0], { preventDefault: true }))) router.go(/*href*/ ctx[0], { preventDefault: true }).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(a, "click", /*click_handler_1*/ ctx[12], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 512)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[9],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[9])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*href*/ 1) {
    				attr_dev(a, "href", /*href*/ ctx[0]);
    			}

    			if (!current || dirty & /*activeClass, classNames*/ 20 && a_class_value !== (a_class_value = "" + (/*activeClass*/ ctx[4] + " " + /*classNames*/ ctx[2]))) {
    				attr_dev(a, "class", a_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(47:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (43:4) {#if natural}
    function create_if_block_1$2(ctx) {
    	let a;
    	let a_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], null);

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			attr_dev(a, "href", /*href*/ ctx[0]);
    			attr_dev(a, "class", a_class_value = "" + (/*activeClass*/ ctx[4] + " " + /*classNames*/ ctx[2]));
    			add_location(a, file$c, 43, 8, 997);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler*/ ctx[11], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 512)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[9],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[9])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*href*/ 1) {
    				attr_dev(a, "href", /*href*/ ctx[0]);
    			}

    			if (!current || dirty & /*activeClass, classNames*/ 20 && a_class_value !== (a_class_value = "" + (/*activeClass*/ ctx[4] + " " + /*classNames*/ ctx[2]))) {
    				attr_dev(a, "class", a_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(43:4) {#if natural}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*isAllowed*/ ctx[3] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*isAllowed*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isAllowed*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let $router;
    	validate_store(router, 'router');
    	component_subscribe($$self, router, $$value => $$invalidate(8, $router = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('A', slots, ['default']);
    	let { href = '#' } = $$props;
    	let { natural = false } = $$props;
    	let { useActive = null } = $$props;
    	let { useExactActive = null } = $$props;
    	let { class: classNames = '' } = $$props;
    	let isAllowed = true;
    	let { visible = () => true } = $$props;
    	let activeClass = '';

    	const check = (store, callback) => {
    		$$invalidate(3, isAllowed = true);

    		if (callback) {
    			$$invalidate(3, isAllowed = callback());

    			if (!isAllowed) {
    				return;
    			}
    		}

    		$$invalidate(4, activeClass = '');

    		if (useExactActive !== null && store.url == href) {
    			$$invalidate(4, activeClass = useExactActive === true ? 'link-active' : useActive);
    			return;
    		}

    		if (useActive !== null && store.url.startsWith(href)) {
    			$$invalidate(4, activeClass = useActive === true ? 'link-active' : useActive);
    		}
    	};

    	const writable_props = ['href', 'natural', 'useActive', 'useExactActive', 'class', 'visible'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<A> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function click_handler_1(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('href' in $$props) $$invalidate(0, href = $$props.href);
    		if ('natural' in $$props) $$invalidate(1, natural = $$props.natural);
    		if ('useActive' in $$props) $$invalidate(5, useActive = $$props.useActive);
    		if ('useExactActive' in $$props) $$invalidate(6, useExactActive = $$props.useExactActive);
    		if ('class' in $$props) $$invalidate(2, classNames = $$props.class);
    		if ('visible' in $$props) $$invalidate(7, visible = $$props.visible);
    		if ('$$scope' in $$props) $$invalidate(9, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		router,
    		href,
    		natural,
    		useActive,
    		useExactActive,
    		classNames,
    		isAllowed,
    		visible,
    		activeClass,
    		check,
    		$router
    	});

    	$$self.$inject_state = $$props => {
    		if ('href' in $$props) $$invalidate(0, href = $$props.href);
    		if ('natural' in $$props) $$invalidate(1, natural = $$props.natural);
    		if ('useActive' in $$props) $$invalidate(5, useActive = $$props.useActive);
    		if ('useExactActive' in $$props) $$invalidate(6, useExactActive = $$props.useExactActive);
    		if ('classNames' in $$props) $$invalidate(2, classNames = $$props.classNames);
    		if ('isAllowed' in $$props) $$invalidate(3, isAllowed = $$props.isAllowed);
    		if ('visible' in $$props) $$invalidate(7, visible = $$props.visible);
    		if ('activeClass' in $$props) $$invalidate(4, activeClass = $$props.activeClass);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$router, visible*/ 384) {
    			check($router, visible);
    		}
    	};

    	return [
    		href,
    		natural,
    		classNames,
    		isAllowed,
    		activeClass,
    		useActive,
    		useExactActive,
    		visible,
    		$router,
    		$$scope,
    		slots,
    		click_handler,
    		click_handler_1
    	];
    }

    class A extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {
    			href: 0,
    			natural: 1,
    			useActive: 5,
    			useExactActive: 6,
    			class: 2,
    			visible: 7
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "A",
    			options,
    			id: create_fragment$d.name
    		});
    	}

    	get href() {
    		throw new Error("<A>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set href(value) {
    		throw new Error("<A>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get natural() {
    		throw new Error("<A>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set natural(value) {
    		throw new Error("<A>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get useActive() {
    		throw new Error("<A>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set useActive(value) {
    		throw new Error("<A>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get useExactActive() {
    		throw new Error("<A>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set useExactActive(value) {
    		throw new Error("<A>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<A>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<A>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get visible() {
    		throw new Error("<A>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set visible(value) {
    		throw new Error("<A>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/lib/forms/Button.svelte generated by Svelte v3.44.2 */

    const file$b = "src/lib/forms/Button.svelte";

    function create_fragment$c(ctx) {
    	let button;
    	let button_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			button.disabled = /*disabled*/ ctx[1];
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty(/*classList*/ ctx[0]) + " svelte-1p1bsy"));
    			toggle_class(button, "block", /*block*/ ctx[2]);
    			add_location(button, file$b, 9, 0, 147);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[3],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[3])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*disabled*/ 2) {
    				prop_dev(button, "disabled", /*disabled*/ ctx[1]);
    			}

    			if (!current || dirty & /*classList*/ 1 && button_class_value !== (button_class_value = "" + (null_to_empty(/*classList*/ ctx[0]) + " svelte-1p1bsy"))) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (dirty & /*classList, block*/ 5) {
    				toggle_class(button, "block", /*block*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block_1;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Button', slots, ['default']);
    	let { class: classList = 'normal' } = $$props;
    	let { disabled = null } = $$props;
    	let { block = false } = $$props;
    	const writable_props = ['class', 'disabled', 'block'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('class' in $$props) $$invalidate(0, classList = $$props.class);
    		if ('disabled' in $$props) $$invalidate(1, disabled = $$props.disabled);
    		if ('block' in $$props) $$invalidate(2, block = $$props.block);
    		if ('$$scope' in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ classList, disabled, block });

    	$$self.$inject_state = $$props => {
    		if ('classList' in $$props) $$invalidate(0, classList = $$props.classList);
    		if ('disabled' in $$props) $$invalidate(1, disabled = $$props.disabled);
    		if ('block' in $$props) $$invalidate(2, block = $$props.block);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [classList, disabled, block, $$scope, slots, click_handler];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, { class: 0, disabled: 1, block: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$c.name
    		});
    	}

    	get class() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get block() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set block(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/lib/forms/Form.svelte generated by Svelte v3.44.2 */

    const file$a = "src/lib/forms/Form.svelte";

    function create_fragment$b(ctx) {
    	let div;
    	let div_class_value;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[8].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", div_class_value = "form " + /*classList*/ ctx[0] + " svelte-16i4r8g");
    			add_location(div, file$a, 101, 0, 2695);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 128)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[7],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[7], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*classList*/ 1 && div_class_value !== (div_class_value = "form " + /*classList*/ ctx[0] + " svelte-16i4r8g")) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const isValidEmail = v => (/[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}/).test(`${v}`);
    const isNumber = v => (/[0-9]+/).test(`${v}`);

    const parseRules = p => {
    	const rules = {};
    	p.required && (rules.required = true);
    	p.minLength && (rules.minLength = +p.minLength);
    	p.maxLength && (rules.maxLength = +p.maxLength);
    	p.minValue && (rules.minValue = +p.minValue);
    	p.maxValue && (rules.maxValue = +p.maxValue);
    	p.isNumeric && (rules.isNumeric = true);
    	p.isEmail && (rules.isEmail = true);
    	p.isPhone && (rules.isPhone = true);
    	return rules;
    };

    const validateItem = (rules, text) => {
    	if (rules.allowsEmpty && text === '') {
    		return null;
    	}

    	if (rules.required && text.length < 1) {
    		return 'Required to be non-empty';
    	}

    	if (rules.isNumeric && !isNumber(text)) {
    		return 'Number required';
    	}

    	if (rules.minLength && text.length < rules.minLength) {
    		return `At least ${rules.minLength} characters are required`;
    	}

    	if (rules.maxLength && text.length > rules.maxLength) {
    		return `The value should have less than ${rules.maxLength} characters`;
    	}

    	if (rules.minValue && !isNumber(text)) {
    		return 'Number required';
    	}

    	if (rules.minValue && +text < rules.minValue) {
    		return 'A bigger number is required';
    	}

    	if (rules.maxValue && !isNumber(text)) {
    		return 'Number required';
    	}

    	if (rules.maxValue && +text > rules.maxValue) {
    		return 'A smaller number is required';
    	}

    	if (rules.isEmail && !isValidEmail(text)) {
    		return `This is not a valid email`;
    	}

    	if (rules.isPhone && text.length < 10) {
    		return `This is not a valid phone`;
    	}

    	return null;
    };

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Form', slots, ['default']);
    	let { class: classList = '' } = $$props;
    	let { valid = true } = $$props;
    	let { live = false } = $$props;

    	const updateElementValidity = v => {
    		$$invalidate(1, valid = valid && v);
    	};

    	let callbacks = [];

    	const registerCheckCallback = callback => {
    		callbacks.push(callback);
    	};

    	const unregisterCheckCallback = callback => {
    		callbacks = callbacks.filter(x => x != callback);
    	};

    	const checkValidity = () => {
    		$$invalidate(1, valid = true);
    		$$invalidate(2, live = true);
    		callbacks.map(cb => cb(true));
    		return valid;
    	};

    	const writable_props = ['class', 'valid', 'live'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Form> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('class' in $$props) $$invalidate(0, classList = $$props.class);
    		if ('valid' in $$props) $$invalidate(1, valid = $$props.valid);
    		if ('live' in $$props) $$invalidate(2, live = $$props.live);
    		if ('$$scope' in $$props) $$invalidate(7, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		isValidEmail,
    		isNumber,
    		parseRules,
    		validateItem,
    		classList,
    		valid,
    		live,
    		updateElementValidity,
    		callbacks,
    		registerCheckCallback,
    		unregisterCheckCallback,
    		checkValidity
    	});

    	$$self.$inject_state = $$props => {
    		if ('classList' in $$props) $$invalidate(0, classList = $$props.classList);
    		if ('valid' in $$props) $$invalidate(1, valid = $$props.valid);
    		if ('live' in $$props) $$invalidate(2, live = $$props.live);
    		if ('callbacks' in $$props) callbacks = $$props.callbacks;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*live, valid*/ 6) {
    			$$invalidate(1, valid = live ? valid : null);
    		}
    	};

    	return [
    		classList,
    		valid,
    		live,
    		updateElementValidity,
    		registerCheckCallback,
    		unregisterCheckCallback,
    		checkValidity,
    		$$scope,
    		slots
    	];
    }

    class Form extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {
    			class: 0,
    			valid: 1,
    			live: 2,
    			updateElementValidity: 3,
    			registerCheckCallback: 4,
    			unregisterCheckCallback: 5,
    			checkValidity: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Form",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get class() {
    		return this.$$.ctx[0];
    	}

    	set class(classList) {
    		this.$$set({ class: classList });
    		flush();
    	}

    	get valid() {
    		return this.$$.ctx[1];
    	}

    	set valid(valid) {
    		this.$$set({ valid });
    		flush();
    	}

    	get live() {
    		return this.$$.ctx[2];
    	}

    	set live(live) {
    		this.$$set({ live });
    		flush();
    	}

    	get updateElementValidity() {
    		return this.$$.ctx[3];
    	}

    	set updateElementValidity(value) {
    		throw new Error("<Form>: Cannot set read-only property 'updateElementValidity'");
    	}

    	get registerCheckCallback() {
    		return this.$$.ctx[4];
    	}

    	set registerCheckCallback(value) {
    		throw new Error("<Form>: Cannot set read-only property 'registerCheckCallback'");
    	}

    	get unregisterCheckCallback() {
    		return this.$$.ctx[5];
    	}

    	set unregisterCheckCallback(value) {
    		throw new Error("<Form>: Cannot set read-only property 'unregisterCheckCallback'");
    	}

    	get checkValidity() {
    		return this.$$.ctx[6];
    	}

    	set checkValidity(value) {
    		throw new Error("<Form>: Cannot set read-only property 'checkValidity'");
    	}
    }

    /* src/lib/forms/Input.svelte generated by Svelte v3.44.2 */
    const file$9 = "src/lib/forms/Input.svelte";

    // (72:4) {#if rules.required}
    function create_if_block_2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("*");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(72:4) {#if rules.required}",
    		ctx
    	});

    	return block;
    }

    // (73:4) {#if showError}
    function create_if_block_1$1(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			attr_dev(span, "class", "sre-form-error sre-fw-n");
    			add_location(span, file$9, 73, 8, 1470);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			span.innerHTML = /*errorText*/ ctx[7];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*errorText*/ 128) span.innerHTML = /*errorText*/ ctx[7];		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(73:4) {#if showError}",
    		ctx
    	});

    	return block;
    }

    // (86:0) {:else}
    function create_else_block$1(ctx) {
    	let input;
    	let input_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", input_class_value = "sre-form-item " + /*classNames*/ ctx[4] + " svelte-1qa4ros");
    			toggle_class(input, "sre-input-error", /*showError*/ ctx[8]);
    			add_location(input, file$9, 86, 4, 1763);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[0]);
    			/*input_binding*/ ctx[15](input);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_input_handler*/ ctx[14]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*classNames*/ 16 && input_class_value !== (input_class_value = "sre-form-item " + /*classNames*/ ctx[4] + " svelte-1qa4ros")) {
    				attr_dev(input, "class", input_class_value);
    			}

    			if (dirty & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
    				set_input_value(input, /*value*/ ctx[0]);
    			}

    			if (dirty & /*classNames, showError*/ 272) {
    				toggle_class(input, "sre-input-error", /*showError*/ ctx[8]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			/*input_binding*/ ctx[15](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(86:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (78:0) {#if multiline}
    function create_if_block$3(ctx) {
    	let textarea;
    	let textarea_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			attr_dev(textarea, "class", textarea_class_value = "sre-form-item " + /*classNames*/ ctx[4] + " svelte-1qa4ros");
    			toggle_class(textarea, "sre-input-error", /*showError*/ ctx[8]);
    			add_location(textarea, file$9, 78, 4, 1571);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);
    			set_input_value(textarea, /*value*/ ctx[0]);
    			/*textarea_binding*/ ctx[13](textarea);

    			if (!mounted) {
    				dispose = listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[12]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*classNames*/ 16 && textarea_class_value !== (textarea_class_value = "sre-form-item " + /*classNames*/ ctx[4] + " svelte-1qa4ros")) {
    				attr_dev(textarea, "class", textarea_class_value);
    			}

    			if (dirty & /*value*/ 1) {
    				set_input_value(textarea, /*value*/ ctx[0]);
    			}

    			if (dirty & /*classNames, showError*/ 272) {
    				toggle_class(textarea, "sre-input-error", /*showError*/ ctx[8]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			/*textarea_binding*/ ctx[13](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(78:0) {#if multiline}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div0;
    	let t0_value = (/*label*/ ctx[1] || '') + "";
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let div1;
    	let if_block0 = /*rules*/ ctx[6].required && create_if_block_2(ctx);
    	let if_block1 = /*showError*/ ctx[8] && create_if_block_1$1(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*multiline*/ ctx[3]) return create_if_block$3;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block2 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			if_block2.c();
    			t4 = space();
    			div1 = element("div");
    			attr_dev(div0, "class", "label svelte-1qa4ros");
    			add_location(div0, file$9, 69, 0, 1371);
    			attr_dev(div1, "class", "sre-form-help");
    			add_location(div1, file$9, 95, 0, 1960);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(div0, t2);
    			if (if_block1) if_block1.m(div0, null);
    			insert_dev(target, t3, anchor);
    			if_block2.m(target, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div1, anchor);
    			div1.innerHTML = /*help*/ ctx[2];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*label*/ 2 && t0_value !== (t0_value = (/*label*/ ctx[1] || '') + "")) set_data_dev(t0, t0_value);

    			if (/*rules*/ ctx[6].required) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(div0, t2);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*showError*/ ctx[8]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					if_block1.m(div0, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(t4.parentNode, t4);
    				}
    			}

    			if (dirty & /*help*/ 4) div1.innerHTML = /*help*/ ctx[2];		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach_dev(t3);
    			if_block2.d(detaching);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Input', slots, []);
    	let { error = null } = $$props;
    	let { label = '' } = $$props;
    	let { help = '' } = $$props;
    	let { hasFocus = false } = $$props;
    	let { form = null } = $$props;
    	let { value = '' } = $$props;
    	let { multiline = false } = $$props;
    	let { class: classNames = '' } = $$props;
    	let element;
    	let rules = {};
    	let errorText = '';
    	let hasError = false;
    	let showError = false;
    	let firstCheck = true;

    	const check = (shouldUpdate = false, v) => {
    		if (!form) {
    			return;
    		}

    		if (!v) {
    			v = value;
    		}

    		const err = validateItem(rules, v);
    		$$invalidate(7, errorText = err ? error || err : '');
    		hasError = !!err;

    		if (hasError) {
    			$$invalidate(8, showError = form.live && !firstCheck);
    		} else {
    			$$invalidate(8, showError = false);
    		}

    		firstCheck = false;
    		form.updateElementValidity(!err);
    	};

    	onMount(async () => {
    		await tick();

    		if (hasFocus) {
    			element.focus();
    		}

    		form.registerCheckCallback(check);
    		check(false); // initial check
    	});

    	onDestroy(() => {
    		form.unregisterCheckCallback(check);
    	});

    	function textarea_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	function textarea_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			element = $$value;
    			$$invalidate(5, element);
    		});
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	function input_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			element = $$value;
    			$$invalidate(5, element);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(19, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ('error' in $$new_props) $$invalidate(9, error = $$new_props.error);
    		if ('label' in $$new_props) $$invalidate(1, label = $$new_props.label);
    		if ('help' in $$new_props) $$invalidate(2, help = $$new_props.help);
    		if ('hasFocus' in $$new_props) $$invalidate(10, hasFocus = $$new_props.hasFocus);
    		if ('form' in $$new_props) $$invalidate(11, form = $$new_props.form);
    		if ('value' in $$new_props) $$invalidate(0, value = $$new_props.value);
    		if ('multiline' in $$new_props) $$invalidate(3, multiline = $$new_props.multiline);
    		if ('class' in $$new_props) $$invalidate(4, classNames = $$new_props.class);
    	};

    	$$self.$capture_state = () => ({
    		parseRules,
    		validateItem,
    		onDestroy,
    		onMount,
    		tick,
    		error,
    		label,
    		help,
    		hasFocus,
    		form,
    		value,
    		multiline,
    		classNames,
    		element,
    		rules,
    		errorText,
    		hasError,
    		showError,
    		firstCheck,
    		check
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(19, $$props = assign(assign({}, $$props), $$new_props));
    		if ('error' in $$props) $$invalidate(9, error = $$new_props.error);
    		if ('label' in $$props) $$invalidate(1, label = $$new_props.label);
    		if ('help' in $$props) $$invalidate(2, help = $$new_props.help);
    		if ('hasFocus' in $$props) $$invalidate(10, hasFocus = $$new_props.hasFocus);
    		if ('form' in $$props) $$invalidate(11, form = $$new_props.form);
    		if ('value' in $$props) $$invalidate(0, value = $$new_props.value);
    		if ('multiline' in $$props) $$invalidate(3, multiline = $$new_props.multiline);
    		if ('classNames' in $$props) $$invalidate(4, classNames = $$new_props.classNames);
    		if ('element' in $$props) $$invalidate(5, element = $$new_props.element);
    		if ('rules' in $$props) $$invalidate(6, rules = $$new_props.rules);
    		if ('errorText' in $$props) $$invalidate(7, errorText = $$new_props.errorText);
    		if ('hasError' in $$props) hasError = $$new_props.hasError;
    		if ('showError' in $$props) $$invalidate(8, showError = $$new_props.showError);
    		if ('firstCheck' in $$props) firstCheck = $$new_props.firstCheck;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		$$invalidate(6, rules = parseRules($$props));

    		if ($$self.$$.dirty & /*value*/ 1) {
    			check(false, value);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		value,
    		label,
    		help,
    		multiline,
    		classNames,
    		element,
    		rules,
    		errorText,
    		showError,
    		error,
    		hasFocus,
    		form,
    		textarea_input_handler,
    		textarea_binding,
    		input_input_handler,
    		input_binding
    	];
    }

    class Input extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {
    			error: 9,
    			label: 1,
    			help: 2,
    			hasFocus: 10,
    			form: 11,
    			value: 0,
    			multiline: 3,
    			class: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Input",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get error() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set error(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get help() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set help(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get hasFocus() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hasFocus(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get form() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set form(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get multiline() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set multiline(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/lib/forms/Checkbox.svelte generated by Svelte v3.44.2 */
    const file$8 = "src/lib/forms/Checkbox.svelte";

    // (60:4) {#if requireChecked}
    function create_if_block_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("*");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(60:4) {#if requireChecked}",
    		ctx
    	});

    	return block;
    }

    // (61:4) {#if showError}
    function create_if_block$2(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			attr_dev(span, "class", "sre-form-error sre-fw-n");
    			add_location(span, file$8, 61, 8, 1217);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			span.innerHTML = /*error*/ ctx[2];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*error*/ 4) span.innerHTML = /*error*/ ctx[2];		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(61:4) {#if showError}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let label_1;
    	let input;
    	let t0;
    	let t1_value = (/*label*/ ctx[3] || '') + "";
    	let t1;
    	let t2;
    	let t3;
    	let mounted;
    	let dispose;
    	let if_block0 = /*requireChecked*/ ctx[4] && create_if_block_1(ctx);
    	let if_block1 = /*showError*/ ctx[5] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			label_1 = element("label");
    			input = element("input");
    			t0 = space();
    			t1 = text(t1_value);
    			t2 = space();
    			if (if_block0) if_block0.c();
    			t3 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(input, "type", "checkbox");
    			add_location(input, file$8, 53, 4, 1049);
    			add_location(label_1, file$8, 52, 0, 1037);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label_1, anchor);
    			append_dev(label_1, input);
    			set_input_value(input, /*value*/ ctx[1]);
    			input.checked = /*checked*/ ctx[0];
    			append_dev(label_1, t0);
    			append_dev(label_1, t1);
    			append_dev(label_1, t2);
    			if (if_block0) if_block0.m(label_1, null);
    			append_dev(label_1, t3);
    			if (if_block1) if_block1.m(label_1, null);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", /*input_change_handler*/ ctx[8]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}

    			if (dirty & /*checked*/ 1) {
    				input.checked = /*checked*/ ctx[0];
    			}

    			if (dirty & /*label*/ 8 && t1_value !== (t1_value = (/*label*/ ctx[3] || '') + "")) set_data_dev(t1, t1_value);

    			if (/*requireChecked*/ ctx[4]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(label_1, t3);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*showError*/ ctx[5]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$2(ctx);
    					if_block1.c();
    					if_block1.m(label_1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label_1);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Checkbox', slots, []);
    	let { form } = $$props;
    	let { value = false } = $$props;
    	let { checked = false } = $$props;
    	let { error = 'This needs to be checked' } = $$props;
    	let { help = '' } = $$props;
    	let { label = 'Checkbox' } = $$props;
    	let { requireChecked = false } = $$props;
    	let hasError = false;
    	let showError = false;
    	let firstCheck = true;

    	const check = (shouldUpdate = false, v) => {
    		if (!form) {
    			return;
    		}

    		hasError = requireChecked && !checked;

    		if (hasError) {
    			$$invalidate(5, showError = form.live && !firstCheck);
    		} else {
    			$$invalidate(5, showError = false);
    		}

    		firstCheck = false;
    		form.updateElementValidity(!hasError);
    	};

    	onMount(async () => {
    		await tick();
    		form.registerCheckCallback(check);
    		check(false);
    	});

    	onDestroy(() => {
    		form.unregisterCheckCallback(check);
    	});

    	const writable_props = ['form', 'value', 'checked', 'error', 'help', 'label', 'requireChecked'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Checkbox> was created with unknown prop '${key}'`);
    	});

    	function input_change_handler() {
    		value = this.value;
    		checked = this.checked;
    		$$invalidate(1, value);
    		$$invalidate(0, checked);
    	}

    	$$self.$$set = $$props => {
    		if ('form' in $$props) $$invalidate(6, form = $$props.form);
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    		if ('checked' in $$props) $$invalidate(0, checked = $$props.checked);
    		if ('error' in $$props) $$invalidate(2, error = $$props.error);
    		if ('help' in $$props) $$invalidate(7, help = $$props.help);
    		if ('label' in $$props) $$invalidate(3, label = $$props.label);
    		if ('requireChecked' in $$props) $$invalidate(4, requireChecked = $$props.requireChecked);
    	};

    	$$self.$capture_state = () => ({
    		onDestroy,
    		onMount,
    		tick,
    		form,
    		value,
    		checked,
    		error,
    		help,
    		label,
    		requireChecked,
    		hasError,
    		showError,
    		firstCheck,
    		check
    	});

    	$$self.$inject_state = $$props => {
    		if ('form' in $$props) $$invalidate(6, form = $$props.form);
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    		if ('checked' in $$props) $$invalidate(0, checked = $$props.checked);
    		if ('error' in $$props) $$invalidate(2, error = $$props.error);
    		if ('help' in $$props) $$invalidate(7, help = $$props.help);
    		if ('label' in $$props) $$invalidate(3, label = $$props.label);
    		if ('requireChecked' in $$props) $$invalidate(4, requireChecked = $$props.requireChecked);
    		if ('hasError' in $$props) hasError = $$props.hasError;
    		if ('showError' in $$props) $$invalidate(5, showError = $$props.showError);
    		if ('firstCheck' in $$props) firstCheck = $$props.firstCheck;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*checked*/ 1) {
    			check(false);
    		}
    	};

    	return [
    		checked,
    		value,
    		error,
    		label,
    		requireChecked,
    		showError,
    		form,
    		help,
    		input_change_handler
    	];
    }

    class Checkbox extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {
    			form: 6,
    			value: 1,
    			checked: 0,
    			error: 2,
    			help: 7,
    			label: 3,
    			requireChecked: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Checkbox",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*form*/ ctx[6] === undefined && !('form' in props)) {
    			console.warn("<Checkbox> was created without expected prop 'form'");
    		}
    	}

    	get form() {
    		throw new Error("<Checkbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set form(value) {
    		throw new Error("<Checkbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Checkbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Checkbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get checked() {
    		throw new Error("<Checkbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checked(value) {
    		throw new Error("<Checkbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get error() {
    		throw new Error("<Checkbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set error(value) {
    		throw new Error("<Checkbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get help() {
    		throw new Error("<Checkbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set help(value) {
    		throw new Error("<Checkbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Checkbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Checkbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get requireChecked() {
    		throw new Error("<Checkbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set requireChecked(value) {
    		throw new Error("<Checkbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/lib/forms/ButtonsPlace.svelte generated by Svelte v3.44.2 */

    const file$7 = "src/lib/forms/ButtonsPlace.svelte";

    function create_fragment$8(ctx) {
    	let div;
    	let div_class_value;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", div_class_value = "btn-place " + /*classList*/ ctx[0] + " svelte-1l80z44");
    			add_location(div, file$7, 5, 0, 77);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*classList*/ 1 && div_class_value !== (div_class_value = "btn-place " + /*classList*/ ctx[0] + " svelte-1l80z44")) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ButtonsPlace', slots, ['default']);
    	let { class: classList = '' } = $$props;
    	const writable_props = ['class'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ButtonsPlace> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('class' in $$props) $$invalidate(0, classList = $$props.class);
    		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ classList });

    	$$self.$inject_state = $$props => {
    		if ('classList' in $$props) $$invalidate(0, classList = $$props.classList);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [classList, $$scope, slots];
    }

    class ButtonsPlace extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { class: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ButtonsPlace",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get class() {
    		throw new Error("<ButtonsPlace>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<ButtonsPlace>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/lib/layout/Spacer.svelte generated by Svelte v3.44.2 */

    const file$6 = "src/lib/layout/Spacer.svelte";

    function create_fragment$7(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(" ");
    			set_style(div, "clear", "both");
    			set_style(div, "height", /*height*/ ctx[0]);
    			add_location(div, file$6, 4, 0, 51);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*height*/ 1) {
    				set_style(div, "height", /*height*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Spacer', slots, []);
    	let { height = '2em' } = $$props;
    	const writable_props = ['height'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Spacer> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('height' in $$props) $$invalidate(0, height = $$props.height);
    	};

    	$$self.$capture_state = () => ({ height });

    	$$self.$inject_state = $$props => {
    		if ('height' in $$props) $$invalidate(0, height = $$props.height);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [height];
    }

    class Spacer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { height: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Spacer",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get height() {
    		throw new Error("<Spacer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Spacer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/lib/demo/parts/FormDemo.svelte generated by Svelte v3.44.2 */
    const file$5 = "src/lib/demo/parts/FormDemo.svelte";
    const get_default_slot_changes_1$4 = dirty => ({});
    const get_default_slot_context_1$4 = ctx => ({ slot: "title" });
    const get_default_slot_changes$4 = dirty => ({});
    const get_default_slot_context$4 = ctx => ({ slot: "body" });

    // (23:8) {#if !formIsValid}
    function create_if_block$1(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "NOT";
    			attr_dev(span, "class", "sre-error");
    			add_location(span, file$5, 23, 12, 617);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(23:8) {#if !formIsValid}",
    		ctx
    	});

    	return block;
    }

    // (21:23)          The following form is         
    function fallback_block_1$4(ctx) {
    	let t0;
    	let t1;
    	let if_block = !/*formIsValid*/ ctx[0] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			t0 = text("The following form is\n        ");
    			if (if_block) if_block.c();
    			t1 = text("\n        valid");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (!/*formIsValid*/ ctx[0]) {
    				if (if_block) ; else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(t1.parentNode, t1);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_1$4.name,
    		type: "fallback",
    		source: "(21:23)          The following form is         ",
    		ctx
    	});

    	return block;
    }

    // (21:4) 
    function create_title_slot$5(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], get_default_slot_context_1$4);
    	const default_slot_or_fallback = default_slot || fallback_block_1$4(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, get_default_slot_changes_1$4),
    						get_default_slot_context_1$4
    					);
    				}
    			} else {
    				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty & /*formIsValid*/ 1)) {
    					default_slot_or_fallback.p(ctx, !current ? -1 : dirty);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot$5.name,
    		type: "slot",
    		source: "(21:4) ",
    		ctx
    	});

    	return block;
    }

    // (30:8) <Form bind:this={form} bind:valid={ formIsValid }>
    function create_default_slot_2$5(ctx) {
    	let input0;
    	let t0;
    	let input1;
    	let t1;
    	let spacer;
    	let t2;
    	let checkbox;
    	let current;

    	input0 = new Input({
    			props: {
    				class: "sre-block",
    				form: /*form*/ ctx[1],
    				label: "Contact's First name",
    				error: "please!",
    				help: "Please enter the first name",
    				required: true
    			},
    			$$inline: true
    		});

    	input1 = new Input({
    			props: {
    				multiline: true,
    				class: "sre-block",
    				form: /*form*/ ctx[1],
    				label: "Contact's data. Please all",
    				error: "Data is required",
    				help: "Please enter the clients data. Dont be afraid",
    				required: true
    			},
    			$$inline: true
    		});

    	spacer = new Spacer({ $$inline: true });

    	checkbox = new Checkbox({
    			props: {
    				form: /*form*/ ctx[1],
    				requireChecked: true,
    				label: "Check to receive newsletter",
    				error: "You need to accept the terms"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(input0.$$.fragment);
    			t0 = space();
    			create_component(input1.$$.fragment);
    			t1 = space();
    			create_component(spacer.$$.fragment);
    			t2 = space();
    			create_component(checkbox.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(input0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(input1, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(spacer, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(checkbox, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const input0_changes = {};
    			if (dirty & /*form*/ 2) input0_changes.form = /*form*/ ctx[1];
    			input0.$set(input0_changes);
    			const input1_changes = {};
    			if (dirty & /*form*/ 2) input1_changes.form = /*form*/ ctx[1];
    			input1.$set(input1_changes);
    			const checkbox_changes = {};
    			if (dirty & /*form*/ 2) checkbox_changes.form = /*form*/ ctx[1];
    			checkbox.$set(checkbox_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(input0.$$.fragment, local);
    			transition_in(input1.$$.fragment, local);
    			transition_in(spacer.$$.fragment, local);
    			transition_in(checkbox.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(input0.$$.fragment, local);
    			transition_out(input1.$$.fragment, local);
    			transition_out(spacer.$$.fragment, local);
    			transition_out(checkbox.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(input0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(input1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(spacer, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(checkbox, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2$5.name,
    		type: "slot",
    		source: "(30:8) <Form bind:this={form} bind:valid={ formIsValid }>",
    		ctx
    	});

    	return block;
    }

    // (29:22)          
    function fallback_block$4(ctx) {
    	let form_1;
    	let updating_valid;
    	let current;

    	function form_1_valid_binding(value) {
    		/*form_1_valid_binding*/ ctx[5](value);
    	}

    	let form_1_props = {
    		$$slots: { default: [create_default_slot_2$5] },
    		$$scope: { ctx }
    	};

    	if (/*formIsValid*/ ctx[0] !== void 0) {
    		form_1_props.valid = /*formIsValid*/ ctx[0];
    	}

    	form_1 = new Form({ props: form_1_props, $$inline: true });
    	/*form_1_binding*/ ctx[4](form_1);
    	binding_callbacks.push(() => bind(form_1, 'valid', form_1_valid_binding));

    	const block = {
    		c: function create() {
    			create_component(form_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(form_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const form_1_changes = {};

    			if (dirty & /*$$scope, form*/ 66) {
    				form_1_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_valid && dirty & /*formIsValid*/ 1) {
    				updating_valid = true;
    				form_1_changes.valid = /*formIsValid*/ ctx[0];
    				add_flush_callback(() => updating_valid = false);
    			}

    			form_1.$set(form_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(form_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(form_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			/*form_1_binding*/ ctx[4](null);
    			destroy_component(form_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block$4.name,
    		type: "fallback",
    		source: "(29:22)          ",
    		ctx
    	});

    	return block;
    }

    // (29:4) 
    function create_body_slot$5(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], get_default_slot_context$4);
    	const default_slot_or_fallback = default_slot || fallback_block$4(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, get_default_slot_changes$4),
    						get_default_slot_context$4
    					);
    				}
    			} else {
    				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty & /*form, formIsValid*/ 3)) {
    					default_slot_or_fallback.p(ctx, !current ? -1 : dirty);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot$5.name,
    		type: "slot",
    		source: "(29:4) ",
    		ctx
    	});

    	return block;
    }

    // (50:12) <Button class="primary" on:click={ submitForm }>
    function create_default_slot_1$6(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Submit");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$6.name,
    		type: "slot",
    		source: "(50:12) <Button class=\\\"primary\\\" on:click={ submitForm }>",
    		ctx
    	});

    	return block;
    }

    // (49:8) <ButtonsPlace class="sre-pad sre-text-right">
    function create_default_slot$6(ctx) {
    	let button;
    	let current;

    	button = new Button({
    			props: {
    				class: "primary",
    				$$slots: { default: [create_default_slot_1$6] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button.$on("click", /*submitForm*/ ctx[2]);

    	const block = {
    		c: function create() {
    			create_component(button.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(button, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(button, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$6.name,
    		type: "slot",
    		source: "(49:8) <ButtonsPlace class=\\\"sre-pad sre-text-right\\\">",
    		ctx
    	});

    	return block;
    }

    // (48:4) 
    function create_footer_slot$2(ctx) {
    	let div;
    	let buttonsplace;
    	let current;

    	buttonsplace = new ButtonsPlace({
    			props: {
    				class: "sre-pad sre-text-right",
    				$$slots: { default: [create_default_slot$6] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(buttonsplace.$$.fragment);
    			attr_dev(div, "slot", "footer");
    			add_location(div, file$5, 47, 4, 1402);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(buttonsplace, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const buttonsplace_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				buttonsplace_changes.$$scope = { dirty, ctx };
    			}

    			buttonsplace.$set(buttonsplace_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(buttonsplace.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(buttonsplace.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(buttonsplace);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_footer_slot$2.name,
    		type: "slot",
    		source: "(48:4) ",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let panel;
    	let t0;
    	let pre;
    	let current;

    	panel = new Panel({
    			props: {
    				$$slots: {
    					footer: [create_footer_slot$2],
    					body: [create_body_slot$5],
    					title: [create_title_slot$5]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(panel.$$.fragment);
    			t0 = space();
    			pre = element("pre");

    			pre.textContent = `${`<Panel>
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
</Panel>`}`;

    			add_location(pre, file$5, 54, 0, 1597);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(panel, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, pre, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const panel_changes = {};

    			if (dirty & /*$$scope, form, formIsValid*/ 67) {
    				panel_changes.$$scope = { dirty, ctx };
    			}

    			panel.$set(panel_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(panel.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(panel.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(panel, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(pre);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FormDemo', slots, ['default']);
    	let formIsValid;
    	let form;

    	const submitForm = () => {
    		form.checkValidity();
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FormDemo> was created with unknown prop '${key}'`);
    	});

    	function form_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			form = $$value;
    			$$invalidate(1, form);
    		});
    	}

    	function form_1_valid_binding(value) {
    		formIsValid = value;
    		$$invalidate(0, formIsValid);
    	}

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(6, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		Panel,
    		Form,
    		Input,
    		Button,
    		Checkbox,
    		ButtonsPlace,
    		Spacer,
    		formIsValid,
    		form,
    		submitForm
    	});

    	$$self.$inject_state = $$props => {
    		if ('formIsValid' in $$props) $$invalidate(0, formIsValid = $$props.formIsValid);
    		if ('form' in $$props) $$invalidate(1, form = $$props.form);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		formIsValid,
    		form,
    		submitForm,
    		slots,
    		form_1_binding,
    		form_1_valid_binding,
    		$$scope
    	];
    }

    class FormDemo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FormDemo",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/lib/demo/parts/ButtonsDemo.svelte generated by Svelte v3.44.2 */
    const file$4 = "src/lib/demo/parts/ButtonsDemo.svelte";
    const get_default_slot_changes_1$3 = dirty => ({});
    const get_default_slot_context_1$3 = ctx => ({ slot: "title" });
    const get_default_slot_changes$3 = dirty => ({});
    const get_default_slot_context$3 = ctx => ({ slot: "body" });

    // (13:23) Buttons
    function fallback_block_1$3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Buttons");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_1$3.name,
    		type: "fallback",
    		source: "(13:23) Buttons",
    		ctx
    	});

    	return block;
    }

    // (13:4) 
    function create_title_slot$4(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], get_default_slot_context_1$3);
    	const default_slot_or_fallback = default_slot || fallback_block_1$3(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[3],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[3])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, get_default_slot_changes_1$3),
    						get_default_slot_context_1$3
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot$4.name,
    		type: "slot",
    		source: "(13:4) ",
    		ctx
    	});

    	return block;
    }

    // (21:8) <Button disabled={ btnDisabled } class="normal">
    function create_default_slot_9$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("normal (no class)");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_9$1.name,
    		type: "slot",
    		source: "(21:8) <Button disabled={ btnDisabled } class=\\\"normal\\\">",
    		ctx
    	});

    	return block;
    }

    // (23:8) <Button disabled={ btnDisabled } class="success">
    function create_default_slot_8$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("success");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_8$1.name,
    		type: "slot",
    		source: "(23:8) <Button disabled={ btnDisabled } class=\\\"success\\\">",
    		ctx
    	});

    	return block;
    }

    // (25:8) <Button disabled={ btnDisabled } class="danger">
    function create_default_slot_7$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("danger");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_7$1.name,
    		type: "slot",
    		source: "(25:8) <Button disabled={ btnDisabled } class=\\\"danger\\\">",
    		ctx
    	});

    	return block;
    }

    // (27:8) <Button disabled={ btnDisabled } class="transparent">
    function create_default_slot_6$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("transparent");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_6$2.name,
    		type: "slot",
    		source: "(27:8) <Button disabled={ btnDisabled } class=\\\"transparent\\\">",
    		ctx
    	});

    	return block;
    }

    // (28:8) <Button disabled={ btnDisabled } class="aslink">
    function create_default_slot_5$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("As a link");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5$2.name,
    		type: "slot",
    		source: "(28:8) <Button disabled={ btnDisabled } class=\\\"aslink\\\">",
    		ctx
    	});

    	return block;
    }

    // (34:8) <Button disabled={ btnDisabled } block class="normal">
    function create_default_slot_4$3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("normal (no class)");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4$3.name,
    		type: "slot",
    		source: "(34:8) <Button disabled={ btnDisabled } block class=\\\"normal\\\">",
    		ctx
    	});

    	return block;
    }

    // (36:8) <Button disabled={ btnDisabled } block class="success">
    function create_default_slot_3$3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("success");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3$3.name,
    		type: "slot",
    		source: "(36:8) <Button disabled={ btnDisabled } block class=\\\"success\\\">",
    		ctx
    	});

    	return block;
    }

    // (38:8) <Button disabled={ btnDisabled } block class="danger">
    function create_default_slot_2$4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("danger");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2$4.name,
    		type: "slot",
    		source: "(38:8) <Button disabled={ btnDisabled } block class=\\\"danger\\\">",
    		ctx
    	});

    	return block;
    }

    // (40:8) <Button disabled={ btnDisabled } block class="transparent">
    function create_default_slot_1$5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("transparent");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$5.name,
    		type: "slot",
    		source: "(40:8) <Button disabled={ btnDisabled } block class=\\\"transparent\\\">",
    		ctx
    	});

    	return block;
    }

    // (42:8) <Button disabled={ btnDisabled } block class="aslink">
    function create_default_slot$5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("As a link");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$5.name,
    		type: "slot",
    		source: "(42:8) <Button disabled={ btnDisabled } block class=\\\"aslink\\\">",
    		ctx
    	});

    	return block;
    }

    // (14:22)          
    function fallback_block$3(ctx) {
    	let div;
    	let label;
    	let input;
    	let t0;
    	let t1;
    	let pre0;
    	let t3;
    	let button0;
    	let t4;
    	let button1;
    	let t5;
    	let button2;
    	let t6;
    	let button3;
    	let t7;
    	let button4;
    	let t8;
    	let spacer;
    	let t9;
    	let br0;
    	let t10;
    	let pre1;
    	let t12;
    	let button5;
    	let t13;
    	let hr0;
    	let t14;
    	let button6;
    	let t15;
    	let hr1;
    	let t16;
    	let button7;
    	let t17;
    	let hr2;
    	let t18;
    	let button8;
    	let t19;
    	let br1;
    	let t20;
    	let button9;
    	let current;
    	let mounted;
    	let dispose;

    	button0 = new Button({
    			props: {
    				disabled: /*btnDisabled*/ ctx[0],
    				class: "normal",
    				$$slots: { default: [create_default_slot_9$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button1 = new Button({
    			props: {
    				disabled: /*btnDisabled*/ ctx[0],
    				class: "success",
    				$$slots: { default: [create_default_slot_8$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button2 = new Button({
    			props: {
    				disabled: /*btnDisabled*/ ctx[0],
    				class: "danger",
    				$$slots: { default: [create_default_slot_7$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button3 = new Button({
    			props: {
    				disabled: /*btnDisabled*/ ctx[0],
    				class: "transparent",
    				$$slots: { default: [create_default_slot_6$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button4 = new Button({
    			props: {
    				disabled: /*btnDisabled*/ ctx[0],
    				class: "aslink",
    				$$slots: { default: [create_default_slot_5$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	spacer = new Spacer({ $$inline: true });

    	button5 = new Button({
    			props: {
    				disabled: /*btnDisabled*/ ctx[0],
    				block: true,
    				class: "normal",
    				$$slots: { default: [create_default_slot_4$3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button6 = new Button({
    			props: {
    				disabled: /*btnDisabled*/ ctx[0],
    				block: true,
    				class: "success",
    				$$slots: { default: [create_default_slot_3$3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button7 = new Button({
    			props: {
    				disabled: /*btnDisabled*/ ctx[0],
    				block: true,
    				class: "danger",
    				$$slots: { default: [create_default_slot_2$4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button8 = new Button({
    			props: {
    				disabled: /*btnDisabled*/ ctx[0],
    				block: true,
    				class: "transparent",
    				$$slots: { default: [create_default_slot_1$5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button9 = new Button({
    			props: {
    				disabled: /*btnDisabled*/ ctx[0],
    				block: true,
    				class: "aslink",
    				$$slots: { default: [create_default_slot$5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			label = element("label");
    			input = element("input");
    			t0 = text(" Disabled state");
    			t1 = space();
    			pre0 = element("pre");
    			pre0.textContent = `${`<Button class="normal|success|danger|transparent|aslink">button text</Button>`}`;
    			t3 = space();
    			create_component(button0.$$.fragment);
    			t4 = space();
    			create_component(button1.$$.fragment);
    			t5 = space();
    			create_component(button2.$$.fragment);
    			t6 = space();
    			create_component(button3.$$.fragment);
    			t7 = space();
    			create_component(button4.$$.fragment);
    			t8 = space();
    			create_component(spacer.$$.fragment);
    			t9 = text("\n        - Add block attribute to make it block");
    			br0 = element("br");
    			t10 = space();
    			pre1 = element("pre");
    			pre1.textContent = `${`<Button class="normal|success|danger|transparent|aslink">button text</Button>`}`;
    			t12 = space();
    			create_component(button5.$$.fragment);
    			t13 = space();
    			hr0 = element("hr");
    			t14 = space();
    			create_component(button6.$$.fragment);
    			t15 = space();
    			hr1 = element("hr");
    			t16 = space();
    			create_component(button7.$$.fragment);
    			t17 = space();
    			hr2 = element("hr");
    			t18 = space();
    			create_component(button8.$$.fragment);
    			t19 = space();
    			br1 = element("br");
    			t20 = space();
    			create_component(button9.$$.fragment);
    			attr_dev(input, "type", "checkbox");
    			add_location(input, file$4, 16, 16, 344);
    			add_location(label, file$4, 15, 12, 320);
    			attr_dev(div, "class", "sre-pad");
    			add_location(div, file$4, 14, 8, 286);
    			add_location(pre0, file$4, 19, 8, 454);
    			add_location(br0, file$4, 31, 46, 1002);
    			add_location(pre1, file$4, 32, 8, 1015);
    			add_location(hr0, file$4, 34, 8, 1205);
    			add_location(hr1, file$4, 36, 8, 1298);
    			add_location(hr2, file$4, 38, 8, 1389);
    			add_location(br1, file$4, 40, 8, 1490);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, label);
    			append_dev(label, input);
    			input.checked = /*btnDisabled*/ ctx[0];
    			append_dev(label, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, pre0, anchor);
    			insert_dev(target, t3, anchor);
    			mount_component(button0, target, anchor);
    			insert_dev(target, t4, anchor);
    			mount_component(button1, target, anchor);
    			insert_dev(target, t5, anchor);
    			mount_component(button2, target, anchor);
    			insert_dev(target, t6, anchor);
    			mount_component(button3, target, anchor);
    			insert_dev(target, t7, anchor);
    			mount_component(button4, target, anchor);
    			insert_dev(target, t8, anchor);
    			mount_component(spacer, target, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, pre1, anchor);
    			insert_dev(target, t12, anchor);
    			mount_component(button5, target, anchor);
    			insert_dev(target, t13, anchor);
    			insert_dev(target, hr0, anchor);
    			insert_dev(target, t14, anchor);
    			mount_component(button6, target, anchor);
    			insert_dev(target, t15, anchor);
    			insert_dev(target, hr1, anchor);
    			insert_dev(target, t16, anchor);
    			mount_component(button7, target, anchor);
    			insert_dev(target, t17, anchor);
    			insert_dev(target, hr2, anchor);
    			insert_dev(target, t18, anchor);
    			mount_component(button8, target, anchor);
    			insert_dev(target, t19, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t20, anchor);
    			mount_component(button9, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(input, "change", /*input_change_handler*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*btnDisabled*/ 1) {
    				input.checked = /*btnDisabled*/ ctx[0];
    			}

    			const button0_changes = {};
    			if (dirty & /*btnDisabled*/ 1) button0_changes.disabled = /*btnDisabled*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};
    			if (dirty & /*btnDisabled*/ 1) button1_changes.disabled = /*btnDisabled*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    			const button2_changes = {};
    			if (dirty & /*btnDisabled*/ 1) button2_changes.disabled = /*btnDisabled*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				button2_changes.$$scope = { dirty, ctx };
    			}

    			button2.$set(button2_changes);
    			const button3_changes = {};
    			if (dirty & /*btnDisabled*/ 1) button3_changes.disabled = /*btnDisabled*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				button3_changes.$$scope = { dirty, ctx };
    			}

    			button3.$set(button3_changes);
    			const button4_changes = {};
    			if (dirty & /*btnDisabled*/ 1) button4_changes.disabled = /*btnDisabled*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				button4_changes.$$scope = { dirty, ctx };
    			}

    			button4.$set(button4_changes);
    			const button5_changes = {};
    			if (dirty & /*btnDisabled*/ 1) button5_changes.disabled = /*btnDisabled*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				button5_changes.$$scope = { dirty, ctx };
    			}

    			button5.$set(button5_changes);
    			const button6_changes = {};
    			if (dirty & /*btnDisabled*/ 1) button6_changes.disabled = /*btnDisabled*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				button6_changes.$$scope = { dirty, ctx };
    			}

    			button6.$set(button6_changes);
    			const button7_changes = {};
    			if (dirty & /*btnDisabled*/ 1) button7_changes.disabled = /*btnDisabled*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				button7_changes.$$scope = { dirty, ctx };
    			}

    			button7.$set(button7_changes);
    			const button8_changes = {};
    			if (dirty & /*btnDisabled*/ 1) button8_changes.disabled = /*btnDisabled*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				button8_changes.$$scope = { dirty, ctx };
    			}

    			button8.$set(button8_changes);
    			const button9_changes = {};
    			if (dirty & /*btnDisabled*/ 1) button9_changes.disabled = /*btnDisabled*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				button9_changes.$$scope = { dirty, ctx };
    			}

    			button9.$set(button9_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			transition_in(button2.$$.fragment, local);
    			transition_in(button3.$$.fragment, local);
    			transition_in(button4.$$.fragment, local);
    			transition_in(spacer.$$.fragment, local);
    			transition_in(button5.$$.fragment, local);
    			transition_in(button6.$$.fragment, local);
    			transition_in(button7.$$.fragment, local);
    			transition_in(button8.$$.fragment, local);
    			transition_in(button9.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			transition_out(button2.$$.fragment, local);
    			transition_out(button3.$$.fragment, local);
    			transition_out(button4.$$.fragment, local);
    			transition_out(spacer.$$.fragment, local);
    			transition_out(button5.$$.fragment, local);
    			transition_out(button6.$$.fragment, local);
    			transition_out(button7.$$.fragment, local);
    			transition_out(button8.$$.fragment, local);
    			transition_out(button9.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(pre0);
    			if (detaching) detach_dev(t3);
    			destroy_component(button0, detaching);
    			if (detaching) detach_dev(t4);
    			destroy_component(button1, detaching);
    			if (detaching) detach_dev(t5);
    			destroy_component(button2, detaching);
    			if (detaching) detach_dev(t6);
    			destroy_component(button3, detaching);
    			if (detaching) detach_dev(t7);
    			destroy_component(button4, detaching);
    			if (detaching) detach_dev(t8);
    			destroy_component(spacer, detaching);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(pre1);
    			if (detaching) detach_dev(t12);
    			destroy_component(button5, detaching);
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(hr0);
    			if (detaching) detach_dev(t14);
    			destroy_component(button6, detaching);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(hr1);
    			if (detaching) detach_dev(t16);
    			destroy_component(button7, detaching);
    			if (detaching) detach_dev(t17);
    			if (detaching) detach_dev(hr2);
    			if (detaching) detach_dev(t18);
    			destroy_component(button8, detaching);
    			if (detaching) detach_dev(t19);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t20);
    			destroy_component(button9, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block$3.name,
    		type: "fallback",
    		source: "(14:22)          ",
    		ctx
    	});

    	return block;
    }

    // (14:4) 
    function create_body_slot$4(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], get_default_slot_context$3);
    	const default_slot_or_fallback = default_slot || fallback_block$3(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[3],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[3])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, get_default_slot_changes$3),
    						get_default_slot_context$3
    					);
    				}
    			} else {
    				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty & /*btnDisabled*/ 1)) {
    					default_slot_or_fallback.p(ctx, !current ? -1 : dirty);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot$4.name,
    		type: "slot",
    		source: "(14:4) ",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let panel;
    	let current;

    	panel = new Panel({
    			props: {
    				$$slots: {
    					body: [create_body_slot$4],
    					title: [create_title_slot$4]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(panel.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(panel, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const panel_changes = {};

    			if (dirty & /*$$scope, btnDisabled*/ 9) {
    				panel_changes.$$scope = { dirty, ctx };
    			}

    			panel.$set(panel_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(panel.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(panel.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(panel, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ButtonsDemo', slots, ['default']);
    	let btnDisabled = false;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ButtonsDemo> was created with unknown prop '${key}'`);
    	});

    	function input_change_handler() {
    		btnDisabled = this.checked;
    		$$invalidate(0, btnDisabled);
    	}

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ Button, Panel, Spacer, btnDisabled });

    	$$self.$inject_state = $$props => {
    		if ('btnDisabled' in $$props) $$invalidate(0, btnDisabled = $$props.btnDisabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [btnDisabled, slots, input_change_handler, $$scope];
    }

    class ButtonsDemo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ButtonsDemo",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/lib/demo/parts/RowCellDemo.svelte generated by Svelte v3.44.2 */
    const file$3 = "src/lib/demo/parts/RowCellDemo.svelte";
    const get_default_slot_changes_1$2 = dirty => ({});
    const get_default_slot_context_1$2 = ctx => ({ slot: "title" });
    const get_default_slot_changes$2 = dirty => ({});
    const get_default_slot_context$2 = ctx => ({ slot: "body" });

    // (7:23) Rows/cells
    function fallback_block_1$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Rows/cells");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_1$2.name,
    		type: "fallback",
    		source: "(7:23) Rows/cells",
    		ctx
    	});

    	return block;
    }

    // (7:4) 
    function create_title_slot$3(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_1$2);
    	const default_slot_or_fallback = default_slot || fallback_block_1$2(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_1$2),
    						get_default_slot_context_1$2
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot$3.name,
    		type: "slot",
    		source: "(7:4) ",
    		ctx
    	});

    	return block;
    }

    // (11:12) <Cell size="none" class="sre-pad">
    function create_default_slot_4$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("2");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4$2.name,
    		type: "slot",
    		source: "(11:12) <Cell size=\\\"none\\\" class=\\\"sre-pad\\\">",
    		ctx
    	});

    	return block;
    }

    // (14:12) <Cell size="2" style="background: orange" class="sre-margin">
    function create_default_slot_3$2(ctx) {
    	let t0;
    	let br0;
    	let t1;
    	let br1;
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text("Other cell contents");
    			br0 = element("br");
    			t1 = text("\n                size=2");
    			br1 = element("br");
    			t2 = text("\n                It is double than the one on the right and is also margined");
    			add_location(br0, file$3, 14, 35, 439);
    			add_location(br1, file$3, 15, 22, 466);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3$2.name,
    		type: "slot",
    		source: "(14:12) <Cell size=\\\"2\\\" style=\\\"background: orange\\\" class=\\\"sre-margin\\\">",
    		ctx
    	});

    	return block;
    }

    // (19:12) <Cell size="1" style="background: yellow">
    function create_default_slot_2$3(ctx) {
    	let t0;
    	let br0;
    	let t1;
    	let br1;
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text("One more cell");
    			br0 = element("br");
    			t1 = text("\n                size=1");
    			br1 = element("br");
    			t2 = text("\n                It is half the size of the one on the right");
    			add_location(br0, file$3, 19, 29, 651);
    			add_location(br1, file$3, 20, 22, 678);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2$3.name,
    		type: "slot",
    		source: "(19:12) <Cell size=\\\"1\\\" style=\\\"background: yellow\\\">",
    		ctx
    	});

    	return block;
    }

    // (24:12) <Cell size="2">
    function create_default_slot_1$4(ctx) {
    	let div;
    	let t0;
    	let br0;
    	let t1;
    	let br1;
    	let t2;
    	let code0;
    	let t4;
    	let code1;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text("You can add any classNames");
    			br0 = element("br");
    			t1 = text("\n                    and any style you want");
    			br1 = element("br");
    			t2 = text("\n                    in the ");
    			code0 = element("code");
    			code0.textContent = "Row";
    			t4 = text(" and ");
    			code1 = element("code");
    			code1.textContent = "Cell";
    			add_location(br0, file$3, 25, 46, 859);
    			add_location(br1, file$3, 26, 42, 906);
    			add_location(code0, file$3, 27, 27, 938);
    			add_location(code1, file$3, 27, 48, 959);
    			add_location(div, file$3, 24, 16, 807);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			append_dev(div, br0);
    			append_dev(div, t1);
    			append_dev(div, br1);
    			append_dev(div, t2);
    			append_dev(div, code0);
    			append_dev(div, t4);
    			append_dev(div, code1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$4.name,
    		type: "slot",
    		source: "(24:12) <Cell size=\\\"2\\\">",
    		ctx
    	});

    	return block;
    }

    // (10:8) <Row>
    function create_default_slot$4(ctx) {
    	let cell0;
    	let t0;
    	let cell1;
    	let t1;
    	let cell2;
    	let t2;
    	let cell3;
    	let current;

    	cell0 = new Cell({
    			props: {
    				size: "none",
    				class: "sre-pad",
    				$$slots: { default: [create_default_slot_4$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	cell1 = new Cell({
    			props: {
    				size: "2",
    				style: "background: orange",
    				class: "sre-margin",
    				$$slots: { default: [create_default_slot_3$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	cell2 = new Cell({
    			props: {
    				size: "1",
    				style: "background: yellow",
    				$$slots: { default: [create_default_slot_2$3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	cell3 = new Cell({
    			props: {
    				size: "2",
    				$$slots: { default: [create_default_slot_1$4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(cell0.$$.fragment);
    			t0 = space();
    			create_component(cell1.$$.fragment);
    			t1 = space();
    			create_component(cell2.$$.fragment);
    			t2 = space();
    			create_component(cell3.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(cell0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(cell1, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(cell2, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(cell3, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const cell0_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				cell0_changes.$$scope = { dirty, ctx };
    			}

    			cell0.$set(cell0_changes);
    			const cell1_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				cell1_changes.$$scope = { dirty, ctx };
    			}

    			cell1.$set(cell1_changes);
    			const cell2_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				cell2_changes.$$scope = { dirty, ctx };
    			}

    			cell2.$set(cell2_changes);
    			const cell3_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				cell3_changes.$$scope = { dirty, ctx };
    			}

    			cell3.$set(cell3_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cell0.$$.fragment, local);
    			transition_in(cell1.$$.fragment, local);
    			transition_in(cell2.$$.fragment, local);
    			transition_in(cell3.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cell0.$$.fragment, local);
    			transition_out(cell1.$$.fragment, local);
    			transition_out(cell2.$$.fragment, local);
    			transition_out(cell3.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(cell0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(cell1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(cell2, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(cell3, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$4.name,
    		type: "slot",
    		source: "(10:8) <Row>",
    		ctx
    	});

    	return block;
    }

    // (8:22)           
    function fallback_block$2(ctx) {
    	let row;
    	let t0;
    	let pre;
    	let current;

    	row = new Row({
    			props: {
    				$$slots: { default: [create_default_slot$4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(row.$$.fragment);
    			t0 = space();
    			pre = element("pre");

    			pre.textContent = `${`<Row>
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
</Row>`}`;

    			add_location(pre, file$3, 32, 0, 1036);
    		},
    		m: function mount(target, anchor) {
    			mount_component(row, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, pre, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const row_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(row, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(pre);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block$2.name,
    		type: "fallback",
    		source: "(8:22)           ",
    		ctx
    	});

    	return block;
    }

    // (8:4) 
    function create_body_slot$3(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context$2);
    	const default_slot_or_fallback = default_slot || fallback_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes$2),
    						get_default_slot_context$2
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot$3.name,
    		type: "slot",
    		source: "(8:4) ",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let panel;
    	let current;

    	panel = new Panel({
    			props: {
    				nopad: true,
    				$$slots: {
    					body: [create_body_slot$3],
    					title: [create_title_slot$3]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(panel.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(panel, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const panel_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				panel_changes.$$scope = { dirty, ctx };
    			}

    			panel.$set(panel_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(panel.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(panel.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(panel, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('RowCellDemo', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<RowCellDemo> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ Panel, Row, Cell });
    	return [slots, $$scope];
    }

    class RowCellDemo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "RowCellDemo",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/lib/demo/parts/PanelDemo.svelte generated by Svelte v3.44.2 */
    const file$2 = "src/lib/demo/parts/PanelDemo.svelte";
    const get_default_slot_changes_13 = dirty => ({});
    const get_default_slot_context_13 = ctx => ({ slot: "title" });
    const get_default_slot_changes_12 = dirty => ({});
    const get_default_slot_context_12 = ctx => ({ slot: "body" });
    const get_default_slot_changes_11 = dirty => ({});
    const get_default_slot_context_11 = ctx => ({ slot: "title" });
    const get_default_slot_changes_10 = dirty => ({});
    const get_default_slot_context_10 = ctx => ({ slot: "body" });
    const get_default_slot_changes_9 = dirty => ({});
    const get_default_slot_context_9 = ctx => ({ slot: "title" });
    const get_default_slot_changes_8 = dirty => ({});
    const get_default_slot_context_8 = ctx => ({ slot: "body" });
    const get_default_slot_changes_7 = dirty => ({});
    const get_default_slot_context_7 = ctx => ({ slot: "body", class: "lalala" });
    const get_default_slot_changes_6 = dirty => ({});
    const get_default_slot_context_6 = ctx => ({ slot: "title", class: "lalala" });
    const get_default_slot_changes_5 = dirty => ({});
    const get_default_slot_context_5 = ctx => ({ slot: "title" });
    const get_default_slot_changes_4 = dirty => ({});
    const get_default_slot_context_4 = ctx => ({ slot: "body" });
    const get_default_slot_changes_3$1 = dirty => ({});
    const get_default_slot_context_3$1 = ctx => ({ slot: "title" });
    const get_default_slot_changes_2$1 = dirty => ({});
    const get_default_slot_context_2$1 = ctx => ({ slot: "body" });
    const get_default_slot_changes_1$1 = dirty => ({});
    const get_default_slot_context_1$1 = ctx => ({ slot: "title" });
    const get_default_slot_changes$1 = dirty => ({});
    const get_default_slot_context$1 = ctx => ({ slot: "body" });

    // (13:35) i am a panel
    function fallback_block_13(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("i am a panel");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_13.name,
    		type: "fallback",
    		source: "(13:35) i am a panel",
    		ctx
    	});

    	return block;
    }

    // (13:16) 
    function create_title_slot_6(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_1$1);
    	const default_slot_or_fallback = default_slot || fallback_block_13(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_1$1),
    						get_default_slot_context_1$1
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot_6.name,
    		type: "slot",
    		source: "(13:16) ",
    		ctx
    	});

    	return block;
    }

    // (14:34) And this is my content. I can be rolled up/down
    function fallback_block_12(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("And this is my content. I can be rolled up/down");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_12.name,
    		type: "fallback",
    		source: "(14:34) And this is my content. I can be rolled up/down",
    		ctx
    	});

    	return block;
    }

    // (14:16) 
    function create_body_slot_6(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context$1);
    	const default_slot_or_fallback = default_slot || fallback_block_12(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes$1),
    						get_default_slot_context$1
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot_6.name,
    		type: "slot",
    		source: "(14:16) ",
    		ctx
    	});

    	return block;
    }

    // (15:16) 
    function create_footer_slot$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "This is the footer. The slot itself is not padded or styled, but you can add the class you want";
    			attr_dev(div, "class", "sre-error");
    			attr_dev(div, "slot", "footer");
    			add_location(div, file$2, 14, 16, 424);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_footer_slot$1.name,
    		type: "slot",
    		source: "(15:16) ",
    		ctx
    	});

    	return block;
    }

    // (36:35) i am a clickable panel
    function fallback_block_11(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("i am a clickable panel");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_11.name,
    		type: "fallback",
    		source: "(36:35) i am a clickable panel",
    		ctx
    	});

    	return block;
    }

    // (36:16) 
    function create_title_slot_5(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_3$1);
    	const default_slot_or_fallback = default_slot || fallback_block_11(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_3$1),
    						get_default_slot_context_3$1
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot_5.name,
    		type: "slot",
    		source: "(36:16) ",
    		ctx
    	});

    	return block;
    }

    // (37:34)                      And I have a dark BG                 
    function fallback_block_10(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("And I have a dark BG");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_10.name,
    		type: "fallback",
    		source: "(37:34)                      And I have a dark BG                 ",
    		ctx
    	});

    	return block;
    }

    // (37:16) 
    function create_body_slot_5(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_2$1);
    	const default_slot_or_fallback = default_slot || fallback_block_10(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_2$1),
    						get_default_slot_context_2$1
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot_5.name,
    		type: "slot",
    		source: "(37:16) ",
    		ctx
    	});

    	return block;
    }

    // (56:35) i am a panel (hoverable!). Click me
    function fallback_block_9(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("i am a panel (hoverable!). Click me");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_9.name,
    		type: "fallback",
    		source: "(56:35) i am a panel (hoverable!). Click me",
    		ctx
    	});

    	return block;
    }

    // (56:16) 
    function create_title_slot_4(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_5);
    	const default_slot_or_fallback = default_slot || fallback_block_9(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_5),
    						get_default_slot_context_5
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot_4.name,
    		type: "slot",
    		source: "(56:16) ",
    		ctx
    	});

    	return block;
    }

    // (57:34)                      but i start as closed                 
    function fallback_block_8(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("but i start as closed");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_8.name,
    		type: "fallback",
    		source: "(57:34)                      but i start as closed                 ",
    		ctx
    	});

    	return block;
    }

    // (57:16) 
    function create_body_slot_4(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_4);
    	const default_slot_or_fallback = default_slot || fallback_block_8(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_4),
    						get_default_slot_context_4
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot_4.name,
    		type: "slot",
    		source: "(57:16) ",
    		ctx
    	});

    	return block;
    }

    // (75:35) i am a panel and I have no content! Essentially, I am a title
    function fallback_block_7(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("i am a panel and I have no content! Essentially, I am a title");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_7.name,
    		type: "fallback",
    		source: "(75:35) i am a panel and I have no content! Essentially, I am a title",
    		ctx
    	});

    	return block;
    }

    // (75:16) 
    function create_title_slot_3(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_6);
    	const default_slot_or_fallback = default_slot || fallback_block_7(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_6),
    						get_default_slot_context_6
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot_3.name,
    		type: "slot",
    		source: "(75:16) ",
    		ctx
    	});

    	return block;
    }

    // (89:49) This is a panel with no title. It is essentially a bordered box                     with a                     border-radius and a margin                 
    function fallback_block_6(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("This is a panel with no title. It is essentially a bordered box\n                    with a\n                    border-radius and a margin");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_6.name,
    		type: "fallback",
    		source: "(89:49) This is a panel with no title. It is essentially a bordered box                     with a                     border-radius and a margin                 ",
    		ctx
    	});

    	return block;
    }

    // (89:16) 
    function create_body_slot_3(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_7);
    	const default_slot_or_fallback = default_slot || fallback_block_6(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_7),
    						get_default_slot_context_7
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot_3.name,
    		type: "slot",
    		source: "(89:16) ",
    		ctx
    	});

    	return block;
    }

    // (107:35) i am a panel
    function fallback_block_5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("i am a panel");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_5.name,
    		type: "fallback",
    		source: "(107:35) i am a panel",
    		ctx
    	});

    	return block;
    }

    // (107:16) 
    function create_title_slot_2(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_9);
    	const default_slot_or_fallback = default_slot || fallback_block_5(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_9),
    						get_default_slot_context_9
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot_2.name,
    		type: "slot",
    		source: "(107:16) ",
    		ctx
    	});

    	return block;
    }

    // (108:34) with a body that has nopad
    function fallback_block_4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("with a body that has nopad");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_4.name,
    		type: "fallback",
    		source: "(108:34) with a body that has nopad",
    		ctx
    	});

    	return block;
    }

    // (108:16) 
    function create_body_slot_2(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_8);
    	const default_slot_or_fallback = default_slot || fallback_block_4(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_8),
    						get_default_slot_context_8
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot_2.name,
    		type: "slot",
    		source: "(108:16) ",
    		ctx
    	});

    	return block;
    }

    // (10:4) <Cell>
    function create_default_slot_2$2(ctx) {
    	let div;
    	let panel0;
    	let t0;
    	let pre0;
    	let t2;
    	let spacer0;
    	let t3;
    	let panel1;
    	let t4;
    	let pre1;
    	let t6;
    	let spacer1;
    	let t7;
    	let panel2;
    	let t8;
    	let pre2;
    	let t10;
    	let spacer2;
    	let t11;
    	let panel3;
    	let t12;
    	let pre3;
    	let t14;
    	let spacer3;
    	let t15;
    	let panel4;
    	let t16;
    	let pre4;
    	let t18;
    	let spacer4;
    	let t19;
    	let panel5;
    	let t20;
    	let pre5;
    	let current;

    	panel0 = new Panel({
    			props: {
    				rolls: true,
    				$$slots: {
    					footer: [create_footer_slot$1],
    					body: [create_body_slot_6],
    					title: [create_title_slot_6]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	spacer0 = new Spacer({ $$inline: true });

    	panel1 = new Panel({
    			props: {
    				plain: true,
    				rolls: true,
    				$$slots: {
    					body: [create_body_slot_5],
    					title: [create_title_slot_5]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	spacer1 = new Spacer({ $$inline: true });

    	panel2 = new Panel({
    			props: {
    				rolled: true,
    				rolls: true,
    				$$slots: {
    					body: [create_body_slot_4],
    					title: [create_title_slot_4]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	spacer2 = new Spacer({ $$inline: true });

    	panel3 = new Panel({
    			props: {
    				$$slots: { title: [create_title_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	spacer3 = new Spacer({ $$inline: true });

    	panel4 = new Panel({
    			props: {
    				$$slots: { body: [create_body_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	spacer4 = new Spacer({ $$inline: true });

    	panel5 = new Panel({
    			props: {
    				nopad: true,
    				$$slots: {
    					body: [create_body_slot_2],
    					title: [create_title_slot_2]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(panel0.$$.fragment);
    			t0 = space();
    			pre0 = element("pre");

    			pre0.textContent = `${`<Panel rolls>
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
</Panel>`}`;

    			t2 = space();
    			create_component(spacer0.$$.fragment);
    			t3 = space();
    			create_component(panel1.$$.fragment);
    			t4 = space();
    			pre1 = element("pre");

    			pre1.textContent = `${`
<Panel plain rolls>
    <slot slot="title">
        i am a clickable panel
    </slot>
    <slot slot="body">
        And I have a dark BG
    </slot>
</Panel>`}`;

    			t6 = space();
    			create_component(spacer1.$$.fragment);
    			t7 = space();
    			create_component(panel2.$$.fragment);
    			t8 = space();
    			pre2 = element("pre");

    			pre2.textContent = `${`<Panel rolled rolls>
    <slot slot="title">
        i am a panel (hoverable!). Click me
    </slot>
    <slot slot="body">
        but i start as closed
    </slot>
</Panel>`}`;

    			t10 = space();
    			create_component(spacer2.$$.fragment);
    			t11 = space();
    			create_component(panel3.$$.fragment);
    			t12 = space();
    			pre3 = element("pre");

    			pre3.textContent = `${`<Panel>
    <slot slot="title">
        i am a panel and I have no content!
        Essentially, I am a title
    </slot>
</Panel>`}`;

    			t14 = space();
    			create_component(spacer3.$$.fragment);
    			t15 = space();
    			create_component(panel4.$$.fragment);
    			t16 = space();
    			pre4 = element("pre");

    			pre4.textContent = `${`<Panel>
    <slot slot="body" class="lalala">
        This is a panel with no title. It is essentially
        a bordered box with a
        border-radius and a margin
    </slot>
</Panel>`}`;

    			t18 = space();
    			create_component(spacer4.$$.fragment);
    			t19 = space();
    			create_component(panel5.$$.fragment);
    			t20 = space();
    			pre5 = element("pre");

    			pre5.textContent = `${`<Panel nopad>
    <slot slot="title">i am a panel</slot>
    <slot slot="body">with a body that has nopad</slot>
</Panel>`}`;

    			add_location(pre0, file$2, 16, 12, 596);
    			add_location(pre1, file$2, 40, 12, 1215);
    			add_location(pre2, file$2, 60, 12, 1666);
    			add_location(pre3, file$2, 76, 12, 2043);
    			add_location(pre4, file$2, 93, 12, 2483);
    			add_location(pre5, file$2, 109, 12, 2899);
    			add_location(div, file$2, 10, 8, 232);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(panel0, div, null);
    			append_dev(div, t0);
    			append_dev(div, pre0);
    			append_dev(div, t2);
    			mount_component(spacer0, div, null);
    			append_dev(div, t3);
    			mount_component(panel1, div, null);
    			append_dev(div, t4);
    			append_dev(div, pre1);
    			append_dev(div, t6);
    			mount_component(spacer1, div, null);
    			append_dev(div, t7);
    			mount_component(panel2, div, null);
    			append_dev(div, t8);
    			append_dev(div, pre2);
    			append_dev(div, t10);
    			mount_component(spacer2, div, null);
    			append_dev(div, t11);
    			mount_component(panel3, div, null);
    			append_dev(div, t12);
    			append_dev(div, pre3);
    			append_dev(div, t14);
    			mount_component(spacer3, div, null);
    			append_dev(div, t15);
    			mount_component(panel4, div, null);
    			append_dev(div, t16);
    			append_dev(div, pre4);
    			append_dev(div, t18);
    			mount_component(spacer4, div, null);
    			append_dev(div, t19);
    			mount_component(panel5, div, null);
    			append_dev(div, t20);
    			append_dev(div, pre5);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const panel0_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				panel0_changes.$$scope = { dirty, ctx };
    			}

    			panel0.$set(panel0_changes);
    			const panel1_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				panel1_changes.$$scope = { dirty, ctx };
    			}

    			panel1.$set(panel1_changes);
    			const panel2_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				panel2_changes.$$scope = { dirty, ctx };
    			}

    			panel2.$set(panel2_changes);
    			const panel3_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				panel3_changes.$$scope = { dirty, ctx };
    			}

    			panel3.$set(panel3_changes);
    			const panel4_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				panel4_changes.$$scope = { dirty, ctx };
    			}

    			panel4.$set(panel4_changes);
    			const panel5_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				panel5_changes.$$scope = { dirty, ctx };
    			}

    			panel5.$set(panel5_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(panel0.$$.fragment, local);
    			transition_in(spacer0.$$.fragment, local);
    			transition_in(panel1.$$.fragment, local);
    			transition_in(spacer1.$$.fragment, local);
    			transition_in(panel2.$$.fragment, local);
    			transition_in(spacer2.$$.fragment, local);
    			transition_in(panel3.$$.fragment, local);
    			transition_in(spacer3.$$.fragment, local);
    			transition_in(panel4.$$.fragment, local);
    			transition_in(spacer4.$$.fragment, local);
    			transition_in(panel5.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(panel0.$$.fragment, local);
    			transition_out(spacer0.$$.fragment, local);
    			transition_out(panel1.$$.fragment, local);
    			transition_out(spacer1.$$.fragment, local);
    			transition_out(panel2.$$.fragment, local);
    			transition_out(spacer2.$$.fragment, local);
    			transition_out(panel3.$$.fragment, local);
    			transition_out(spacer3.$$.fragment, local);
    			transition_out(panel4.$$.fragment, local);
    			transition_out(spacer4.$$.fragment, local);
    			transition_out(panel5.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(panel0);
    			destroy_component(spacer0);
    			destroy_component(panel1);
    			destroy_component(spacer1);
    			destroy_component(panel2);
    			destroy_component(spacer2);
    			destroy_component(panel3);
    			destroy_component(spacer3);
    			destroy_component(panel4);
    			destroy_component(spacer4);
    			destroy_component(panel5);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2$2.name,
    		type: "slot",
    		source: "(10:4) <Cell>",
    		ctx
    	});

    	return block;
    }

    // (121:35) Attrs
    function fallback_block_3$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Attrs");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_3$1.name,
    		type: "fallback",
    		source: "(121:35) Attrs",
    		ctx
    	});

    	return block;
    }

    // (121:16) 
    function create_title_slot_1$1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_11);
    	const default_slot_or_fallback = default_slot || fallback_block_3$1(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_11),
    						get_default_slot_context_11
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot_1$1.name,
    		type: "slot",
    		source: "(121:16) ",
    		ctx
    	});

    	return block;
    }

    // (122:34)                      &bull; 
    function fallback_block_2$1(ctx) {
    	let t0;
    	let tt0;
    	let t2;
    	let br0;
    	let t3;
    	let tt1;
    	let t5;
    	let br1;
    	let t6;
    	let tt2;
    	let t8;
    	let br2;
    	let t9;
    	let tt3;
    	let t11;
    	let br3;
    	let t12;
    	let tt4;
    	let t14;
    	let br4;
    	let t15;
    	let tt5;
    	let t17;

    	const block = {
    		c: function create() {
    			t0 = text("• ");
    			tt0 = element("tt");
    			tt0.textContent = "class";
    			t2 = text(" = ''");
    			br0 = element("br");
    			t3 = text("\n                    • ");
    			tt1 = element("tt");
    			tt1.textContent = "rolls";
    			t5 = text(" = false");
    			br1 = element("br");
    			t6 = text("\n                    • ");
    			tt2 = element("tt");
    			tt2.textContent = "rolled";
    			t8 = text(" = false");
    			br2 = element("br");
    			t9 = text("\n                    • ");
    			tt3 = element("tt");
    			tt3.textContent = "style";
    			t11 = text(" = ''");
    			br3 = element("br");
    			t12 = text("\n                    • ");
    			tt4 = element("tt");
    			tt4.textContent = "nopad";
    			t14 = text(" = false");
    			br4 = element("br");
    			t15 = text("\n                    • ");
    			tt5 = element("tt");
    			tt5.textContent = "plain";
    			t17 = text(" = false");
    			add_location(tt0, file$2, 122, 27, 3233);
    			add_location(br0, file$2, 122, 46, 3252);
    			add_location(tt1, file$2, 123, 27, 3284);
    			add_location(br1, file$2, 123, 49, 3306);
    			add_location(tt2, file$2, 124, 27, 3338);
    			add_location(br2, file$2, 124, 50, 3361);
    			add_location(tt3, file$2, 125, 27, 3393);
    			add_location(br3, file$2, 125, 46, 3412);
    			add_location(tt4, file$2, 126, 27, 3444);
    			add_location(br4, file$2, 126, 49, 3466);
    			add_location(tt5, file$2, 127, 27, 3498);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, tt0, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, tt1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, tt2, anchor);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, br2, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, tt3, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, br3, anchor);
    			insert_dev(target, t12, anchor);
    			insert_dev(target, tt4, anchor);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, br4, anchor);
    			insert_dev(target, t15, anchor);
    			insert_dev(target, tt5, anchor);
    			insert_dev(target, t17, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(tt0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(tt1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(tt2);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(br2);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(tt3);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(br3);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(tt4);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(br4);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(tt5);
    			if (detaching) detach_dev(t17);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_2$1.name,
    		type: "fallback",
    		source: "(122:34)                      &bull; ",
    		ctx
    	});

    	return block;
    }

    // (122:16) 
    function create_body_slot_1$1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_10);
    	const default_slot_or_fallback = default_slot || fallback_block_2$1(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_10),
    						get_default_slot_context_10
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot_1$1.name,
    		type: "slot",
    		source: "(122:16) ",
    		ctx
    	});

    	return block;
    }

    // (132:35) Slots
    function fallback_block_1$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Slots");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_1$1.name,
    		type: "fallback",
    		source: "(132:35) Slots",
    		ctx
    	});

    	return block;
    }

    // (132:16) 
    function create_title_slot$2(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_13);
    	const default_slot_or_fallback = default_slot || fallback_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_13),
    						get_default_slot_context_13
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot$2.name,
    		type: "slot",
    		source: "(132:16) ",
    		ctx
    	});

    	return block;
    }

    // (133:34)                      &bull; title
    function fallback_block$1(ctx) {
    	let t0;
    	let br0;
    	let t1;
    	let br1;
    	let t2;
    	let br2;

    	const block = {
    		c: function create() {
    			t0 = text("• title");
    			br0 = element("br");
    			t1 = text("\n                    • body");
    			br1 = element("br");
    			t2 = text("\n                    • footer");
    			br2 = element("br");
    			add_location(br0, file$2, 133, 32, 3701);
    			add_location(br1, file$2, 134, 31, 3737);
    			add_location(br2, file$2, 135, 33, 3775);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, br2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(br2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block$1.name,
    		type: "fallback",
    		source: "(133:34)                      &bull; title",
    		ctx
    	});

    	return block;
    }

    // (133:16) 
    function create_body_slot$2(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_12);
    	const default_slot_or_fallback = default_slot || fallback_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_12),
    						get_default_slot_context_12
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot$2.name,
    		type: "slot",
    		source: "(133:16) ",
    		ctx
    	});

    	return block;
    }

    // (118:4) <Cell size="4">
    function create_default_slot_1$3(ctx) {
    	let div;
    	let panel0;
    	let t;
    	let panel1;
    	let current;

    	panel0 = new Panel({
    			props: {
    				$$slots: {
    					body: [create_body_slot_1$1],
    					title: [create_title_slot_1$1]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	panel1 = new Panel({
    			props: {
    				$$slots: {
    					body: [create_body_slot$2],
    					title: [create_title_slot$2]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(panel0.$$.fragment);
    			t = space();
    			create_component(panel1.$$.fragment);
    			add_location(div, file$2, 118, 8, 3097);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(panel0, div, null);
    			append_dev(div, t);
    			mount_component(panel1, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const panel0_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				panel0_changes.$$scope = { dirty, ctx };
    			}

    			panel0.$set(panel0_changes);
    			const panel1_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				panel1_changes.$$scope = { dirty, ctx };
    			}

    			panel1.$set(panel1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(panel0.$$.fragment, local);
    			transition_in(panel1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(panel0.$$.fragment, local);
    			transition_out(panel1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(panel0);
    			destroy_component(panel1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$3.name,
    		type: "slot",
    		source: "(118:4) <Cell size=\\\"4\\\">",
    		ctx
    	});

    	return block;
    }

    // (9:0) <Row>
    function create_default_slot$3(ctx) {
    	let cell0;
    	let t;
    	let cell1;
    	let current;

    	cell0 = new Cell({
    			props: {
    				$$slots: { default: [create_default_slot_2$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	cell1 = new Cell({
    			props: {
    				size: "4",
    				$$slots: { default: [create_default_slot_1$3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(cell0.$$.fragment);
    			t = space();
    			create_component(cell1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(cell0, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(cell1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const cell0_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				cell0_changes.$$scope = { dirty, ctx };
    			}

    			cell0.$set(cell0_changes);
    			const cell1_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				cell1_changes.$$scope = { dirty, ctx };
    			}

    			cell1.$set(cell1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cell0.$$.fragment, local);
    			transition_in(cell1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cell0.$$.fragment, local);
    			transition_out(cell1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(cell0, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(cell1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(9:0) <Row>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let row;
    	let current;

    	row = new Row({
    			props: {
    				$$slots: { default: [create_default_slot$3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(row.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(row, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const row_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(row, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PanelDemo', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<PanelDemo> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ Panel, Spacer, Row, Cell });
    	return [slots, $$scope];
    }

    class PanelDemo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PanelDemo",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/lib/demo/parts/ButtonsPlaceDemo.svelte generated by Svelte v3.44.2 */
    const file$1 = "src/lib/demo/parts/ButtonsPlaceDemo.svelte";
    const get_default_slot_changes_3 = dirty => ({});
    const get_default_slot_context_3 = ctx => ({ slot: "title" });
    const get_default_slot_changes_2 = dirty => ({});
    const get_default_slot_context_2 = ctx => ({ slot: "body" });
    const get_default_slot_changes_1 = dirty => ({});
    const get_default_slot_context_1 = ctx => ({ slot: "title" });
    const get_default_slot_changes = dirty => ({});
    const get_default_slot_context = ctx => ({ slot: "body" });

    // (8:23)          Panel Title     
    function fallback_block_3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Panel Title");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_3.name,
    		type: "fallback",
    		source: "(8:23)          Panel Title     ",
    		ctx
    	});

    	return block;
    }

    // (8:4) 
    function create_title_slot_1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], get_default_slot_context_1);
    	const default_slot_or_fallback = default_slot || fallback_block_3(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, get_default_slot_changes_1),
    						get_default_slot_context_1
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot_1.name,
    		type: "slot",
    		source: "(8:4) ",
    		ctx
    	});

    	return block;
    }

    // (12:22)          Panels content     
    function fallback_block_2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Panels content");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_2.name,
    		type: "fallback",
    		source: "(12:22)          Panels content     ",
    		ctx
    	});

    	return block;
    }

    // (12:4) 
    function create_body_slot_1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], get_default_slot_context);
    	const default_slot_or_fallback = default_slot || fallback_block_2(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, get_default_slot_changes),
    						get_default_slot_context
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot_1.name,
    		type: "slot",
    		source: "(12:4) ",
    		ctx
    	});

    	return block;
    }

    // (17:12) <Button class="transparent" on:click>
    function create_default_slot_6$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Cancel");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_6$1.name,
    		type: "slot",
    		source: "(17:12) <Button class=\\\"transparent\\\" on:click>",
    		ctx
    	});

    	return block;
    }

    // (18:12) <Button class="primary" on:click>
    function create_default_slot_5$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("OK");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5$1.name,
    		type: "slot",
    		source: "(18:12) <Button class=\\\"primary\\\" on:click>",
    		ctx
    	});

    	return block;
    }

    // (16:8) <ButtonsPlace class="sre-pad sre-text-right">
    function create_default_slot_4$1(ctx) {
    	let button0;
    	let t;
    	let button1;
    	let current;

    	button0 = new Button({
    			props: {
    				class: "transparent",
    				$$slots: { default: [create_default_slot_6$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button0.$on("click", /*click_handler*/ ctx[1]);

    	button1 = new Button({
    			props: {
    				class: "primary",
    				$$slots: { default: [create_default_slot_5$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button1.$on("click", /*click_handler_1*/ ctx[2]);

    	const block = {
    		c: function create() {
    			create_component(button0.$$.fragment);
    			t = space();
    			create_component(button1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(button0, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(button1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const button0_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(button0, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(button1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4$1.name,
    		type: "slot",
    		source: "(16:8) <ButtonsPlace class=\\\"sre-pad sre-text-right\\\">",
    		ctx
    	});

    	return block;
    }

    // (15:4) 
    function create_footer_slot_1(ctx) {
    	let div;
    	let buttonsplace;
    	let current;

    	buttonsplace = new ButtonsPlace({
    			props: {
    				class: "sre-pad sre-text-right",
    				$$slots: { default: [create_default_slot_4$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(buttonsplace.$$.fragment);
    			attr_dev(div, "slot", "footer");
    			add_location(div, file$1, 14, 4, 366);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(buttonsplace, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const buttonsplace_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				buttonsplace_changes.$$scope = { dirty, ctx };
    			}

    			buttonsplace.$set(buttonsplace_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(buttonsplace.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(buttonsplace.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(buttonsplace);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_footer_slot_1.name,
    		type: "slot",
    		source: "(15:4) ",
    		ctx
    	});

    	return block;
    }

    // (42:23)          About to close the browser...     
    function fallback_block_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("About to close the browser...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_1.name,
    		type: "fallback",
    		source: "(42:23)          About to close the browser...     ",
    		ctx
    	});

    	return block;
    }

    // (42:4) 
    function create_title_slot$1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], get_default_slot_context_3);
    	const default_slot_or_fallback = default_slot || fallback_block_1(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, get_default_slot_changes_3),
    						get_default_slot_context_3
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot$1.name,
    		type: "slot",
    		source: "(42:4) ",
    		ctx
    	});

    	return block;
    }

    // (46:22)          Do you want to save the file before closing?     
    function fallback_block(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Do you want to save the file before closing?");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block.name,
    		type: "fallback",
    		source: "(46:22)          Do you want to save the file before closing?     ",
    		ctx
    	});

    	return block;
    }

    // (46:4) 
    function create_body_slot$1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[0].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], get_default_slot_context_2);
    	const default_slot_or_fallback = default_slot || fallback_block(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, get_default_slot_changes_2),
    						get_default_slot_context_2
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot$1.name,
    		type: "slot",
    		source: "(46:4) ",
    		ctx
    	});

    	return block;
    }

    // (51:12) <Button class="transparent sre-to-left" on:click>
    function create_default_slot_3$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Cancel");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3$1.name,
    		type: "slot",
    		source: "(51:12) <Button class=\\\"transparent sre-to-left\\\" on:click>",
    		ctx
    	});

    	return block;
    }

    // (52:12) <Button class="primary" on:click>
    function create_default_slot_2$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("NO");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2$1.name,
    		type: "slot",
    		source: "(52:12) <Button class=\\\"primary\\\" on:click>",
    		ctx
    	});

    	return block;
    }

    // (53:12) <Button class="danger" on:click>
    function create_default_slot_1$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("YES");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$2.name,
    		type: "slot",
    		source: "(53:12) <Button class=\\\"danger\\\" on:click>",
    		ctx
    	});

    	return block;
    }

    // (50:8) <ButtonsPlace class="sre-pad sre-text-right">
    function create_default_slot$2(ctx) {
    	let button0;
    	let t0;
    	let button1;
    	let t1;
    	let button2;
    	let current;

    	button0 = new Button({
    			props: {
    				class: "transparent sre-to-left",
    				$$slots: { default: [create_default_slot_3$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button0.$on("click", /*click_handler_2*/ ctx[3]);

    	button1 = new Button({
    			props: {
    				class: "primary",
    				$$slots: { default: [create_default_slot_2$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button1.$on("click", /*click_handler_3*/ ctx[4]);

    	button2 = new Button({
    			props: {
    				class: "danger",
    				$$slots: { default: [create_default_slot_1$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button2.$on("click", /*click_handler_4*/ ctx[5]);

    	const block = {
    		c: function create() {
    			create_component(button0.$$.fragment);
    			t0 = space();
    			create_component(button1.$$.fragment);
    			t1 = space();
    			create_component(button2.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(button0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(button1, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(button2, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const button0_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    			const button2_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				button2_changes.$$scope = { dirty, ctx };
    			}

    			button2.$set(button2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			transition_in(button2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			transition_out(button2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(button0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(button1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(button2, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(50:8) <ButtonsPlace class=\\\"sre-pad sre-text-right\\\">",
    		ctx
    	});

    	return block;
    }

    // (49:4) 
    function create_footer_slot(ctx) {
    	let div;
    	let buttonsplace;
    	let current;

    	buttonsplace = new ButtonsPlace({
    			props: {
    				class: "sre-pad sre-text-right",
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(buttonsplace.$$.fragment);
    			attr_dev(div, "slot", "footer");
    			add_location(div, file$1, 48, 4, 1176);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(buttonsplace, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const buttonsplace_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				buttonsplace_changes.$$scope = { dirty, ctx };
    			}

    			buttonsplace.$set(buttonsplace_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(buttonsplace.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(buttonsplace.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(buttonsplace);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_footer_slot.name,
    		type: "slot",
    		source: "(49:4) ",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let panel0;
    	let t0;
    	let pre0;
    	let t2;
    	let spacer;
    	let t3;
    	let panel1;
    	let t4;
    	let pre1;
    	let current;

    	panel0 = new Panel({
    			props: {
    				$$slots: {
    					footer: [create_footer_slot_1],
    					body: [create_body_slot_1],
    					title: [create_title_slot_1]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	spacer = new Spacer({ $$inline: true });

    	panel1 = new Panel({
    			props: {
    				$$slots: {
    					footer: [create_footer_slot],
    					body: [create_body_slot$1],
    					title: [create_title_slot$1]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(panel0.$$.fragment);
    			t0 = space();
    			pre0 = element("pre");

    			pre0.textContent = `${`<Panel>
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
`}`;

    			t2 = space();
    			create_component(spacer.$$.fragment);
    			t3 = space();
    			create_component(panel1.$$.fragment);
    			t4 = space();
    			pre1 = element("pre");

    			pre1.textContent = `${`<Panel>
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
`}`;

    			add_location(pre0, file$1, 22, 0, 607);
    			add_location(pre1, file$1, 57, 0, 1486);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(panel0, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, pre0, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(spacer, target, anchor);
    			insert_dev(target, t3, anchor);
    			mount_component(panel1, target, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, pre1, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const panel0_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				panel0_changes.$$scope = { dirty, ctx };
    			}

    			panel0.$set(panel0_changes);
    			const panel1_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				panel1_changes.$$scope = { dirty, ctx };
    			}

    			panel1.$set(panel1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(panel0.$$.fragment, local);
    			transition_in(spacer.$$.fragment, local);
    			transition_in(panel1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(panel0.$$.fragment, local);
    			transition_out(spacer.$$.fragment, local);
    			transition_out(panel1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(panel0, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(pre0);
    			if (detaching) detach_dev(t2);
    			destroy_component(spacer, detaching);
    			if (detaching) detach_dev(t3);
    			destroy_component(panel1, detaching);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(pre1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ButtonsPlaceDemo', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ButtonsPlaceDemo> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function click_handler_1(event) {
    		bubble.call(this, $$self, event);
    	}

    	function click_handler_2(event) {
    		bubble.call(this, $$self, event);
    	}

    	function click_handler_3(event) {
    		bubble.call(this, $$self, event);
    	}

    	function click_handler_4(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(6, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ Panel, ButtonsPlace, Button, Spacer });

    	return [
    		slots,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		$$scope
    	];
    }

    class ButtonsPlaceDemo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ButtonsPlaceDemo",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/lib/demo/Demo.svelte generated by Svelte v3.44.2 */
    const file = "src/lib/demo/Demo.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (22:12) {:else}
    function create_else_block(ctx) {
    	let a;
    	let t;
    	let current;

    	a = new A({
    			props: {
    				href: /*item*/ ctx[3].link,
    				$$slots: { default: [create_default_slot_14] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(a.$$.fragment);
    			t = text(" / ");
    		},
    		m: function mount(target, anchor) {
    			mount_component(a, target, anchor);
    			insert_dev(target, t, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const a_changes = {};
    			if (dirty & /*$breadCrumb*/ 1) a_changes.href = /*item*/ ctx[3].link;

    			if (dirty & /*$$scope, $breadCrumb*/ 65) {
    				a_changes.$$scope = { dirty, ctx };
    			}

    			a.$set(a_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(a.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(a.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(a, detaching);
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(22:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (20:12) {#if item.current}
    function create_if_block(ctx) {
    	let t_value = /*item*/ ctx[3].text + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$breadCrumb*/ 1 && t_value !== (t_value = /*item*/ ctx[3].text + "")) set_data_dev(t, t_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(20:12) {#if item.current}",
    		ctx
    	});

    	return block;
    }

    // (23:16) <A href={ item.link}>
    function create_default_slot_14(ctx) {
    	let t_value = /*item*/ ctx[3].text + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$breadCrumb*/ 1 && t_value !== (t_value = /*item*/ ctx[3].text + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_14.name,
    		type: "slot",
    		source: "(23:16) <A href={ item.link}>",
    		ctx
    	});

    	return block;
    }

    // (19:8) {#each $breadCrumb as item}
    function create_each_block(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*item*/ ctx[3].current) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(19:8) {#each $breadCrumb as item}",
    		ctx
    	});

    	return block;
    }

    // (32:16) 
    function create_title_slot(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "Menu";
    			attr_dev(div, "slot", "title");
    			add_location(div, file, 31, 16, 986);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_title_slot.name,
    		type: "slot",
    		source: "(32:16) ",
    		ctx
    	});

    	return block;
    }

    // (34:20) <A useActive class="sre-small-pad" href="/demo/panel">
    function create_default_slot_13(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Panel");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_13.name,
    		type: "slot",
    		source: "(34:20) <A useActive class=\\\"sre-small-pad\\\" href=\\\"/demo/panel\\\">",
    		ctx
    	});

    	return block;
    }

    // (35:20) <A useActive class="sre-small-pad" href="/demo/rowcell">
    function create_default_slot_12(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("RowCell");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_12.name,
    		type: "slot",
    		source: "(35:20) <A useActive class=\\\"sre-small-pad\\\" href=\\\"/demo/rowcell\\\">",
    		ctx
    	});

    	return block;
    }

    // (36:20) <A useActive class="sre-small-pad" href="/demo/buttons">
    function create_default_slot_11(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Buttons");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_11.name,
    		type: "slot",
    		source: "(36:20) <A useActive class=\\\"sre-small-pad\\\" href=\\\"/demo/buttons\\\">",
    		ctx
    	});

    	return block;
    }

    // (37:20) <A useActive class="sre-small-pad" href="/demo/form">
    function create_default_slot_10(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Form");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_10.name,
    		type: "slot",
    		source: "(37:20) <A useActive class=\\\"sre-small-pad\\\" href=\\\"/demo/form\\\">",
    		ctx
    	});

    	return block;
    }

    // (38:20) <A useActive class="sre-small-pad" href="/demo/buttons-place">
    function create_default_slot_9(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("BtnPlace");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_9.name,
    		type: "slot",
    		source: "(38:20) <A useActive class=\\\"sre-small-pad\\\" href=\\\"/demo/buttons-place\\\">",
    		ctx
    	});

    	return block;
    }

    // (33:16) 
    function create_body_slot(ctx) {
    	let div;
    	let a0;
    	let t0;
    	let a1;
    	let t1;
    	let a2;
    	let t2;
    	let a3;
    	let t3;
    	let a4;
    	let current;

    	a0 = new A({
    			props: {
    				useActive: true,
    				class: "sre-small-pad",
    				href: "/demo/panel",
    				$$slots: { default: [create_default_slot_13] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	a1 = new A({
    			props: {
    				useActive: true,
    				class: "sre-small-pad",
    				href: "/demo/rowcell",
    				$$slots: { default: [create_default_slot_12] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	a2 = new A({
    			props: {
    				useActive: true,
    				class: "sre-small-pad",
    				href: "/demo/buttons",
    				$$slots: { default: [create_default_slot_11] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	a3 = new A({
    			props: {
    				useActive: true,
    				class: "sre-small-pad",
    				href: "/demo/form",
    				$$slots: { default: [create_default_slot_10] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	a4 = new A({
    			props: {
    				useActive: true,
    				class: "sre-small-pad",
    				href: "/demo/buttons-place",
    				$$slots: { default: [create_default_slot_9] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(a0.$$.fragment);
    			t0 = space();
    			create_component(a1.$$.fragment);
    			t1 = space();
    			create_component(a2.$$.fragment);
    			t2 = space();
    			create_component(a3.$$.fragment);
    			t3 = space();
    			create_component(a4.$$.fragment);
    			attr_dev(div, "slot", "body");
    			attr_dev(div, "class", "sre-childs-block");
    			add_location(div, file, 32, 16, 1031);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(a0, div, null);
    			append_dev(div, t0);
    			mount_component(a1, div, null);
    			append_dev(div, t1);
    			mount_component(a2, div, null);
    			append_dev(div, t2);
    			mount_component(a3, div, null);
    			append_dev(div, t3);
    			mount_component(a4, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const a0_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				a0_changes.$$scope = { dirty, ctx };
    			}

    			a0.$set(a0_changes);
    			const a1_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				a1_changes.$$scope = { dirty, ctx };
    			}

    			a1.$set(a1_changes);
    			const a2_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				a2_changes.$$scope = { dirty, ctx };
    			}

    			a2.$set(a2_changes);
    			const a3_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				a3_changes.$$scope = { dirty, ctx };
    			}

    			a3.$set(a3_changes);
    			const a4_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				a4_changes.$$scope = { dirty, ctx };
    			}

    			a4.$set(a4_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(a0.$$.fragment, local);
    			transition_in(a1.$$.fragment, local);
    			transition_in(a2.$$.fragment, local);
    			transition_in(a3.$$.fragment, local);
    			transition_in(a4.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(a0.$$.fragment, local);
    			transition_out(a1.$$.fragment, local);
    			transition_out(a2.$$.fragment, local);
    			transition_out(a3.$$.fragment, local);
    			transition_out(a4.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(a0);
    			destroy_component(a1);
    			destroy_component(a2);
    			destroy_component(a3);
    			destroy_component(a4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_body_slot.name,
    		type: "slot",
    		source: "(33:16) ",
    		ctx
    	});

    	return block;
    }

    // (30:8) <Cell style="align-self: flex-start">
    function create_default_slot_8(ctx) {
    	let panel;
    	let current;

    	panel = new Panel({
    			props: {
    				plain: true,
    				nopad: true,
    				$$slots: {
    					body: [create_body_slot],
    					title: [create_title_slot]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(panel.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(panel, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const panel_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				panel_changes.$$scope = { dirty, ctx };
    			}

    			panel.$set(panel_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(panel.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(panel.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(panel, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_8.name,
    		type: "slot",
    		source: "(30:8) <Cell style=\\\"align-self: flex-start\\\">",
    		ctx
    	});

    	return block;
    }

    // (44:12) <Route single match="panel" breadcrumb="panels">
    function create_default_slot_7(ctx) {
    	let paneldemo;
    	let current;
    	paneldemo = new PanelDemo({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(paneldemo.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(paneldemo, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(paneldemo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(paneldemo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(paneldemo, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_7.name,
    		type: "slot",
    		source: "(44:12) <Route single match=\\\"panel\\\" breadcrumb=\\\"panels\\\">",
    		ctx
    	});

    	return block;
    }

    // (49:12) <Route single match="rowcell" breadcrumb="rowcell">
    function create_default_slot_6(ctx) {
    	let rowcelldemo;
    	let current;
    	rowcelldemo = new RowCellDemo({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(rowcelldemo.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(rowcelldemo, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(rowcelldemo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(rowcelldemo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(rowcelldemo, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_6.name,
    		type: "slot",
    		source: "(49:12) <Route single match=\\\"rowcell\\\" breadcrumb=\\\"rowcell\\\">",
    		ctx
    	});

    	return block;
    }

    // (53:12) <Route single match="buttons" breadcrumb="buttons">
    function create_default_slot_5(ctx) {
    	let buttonsdemo;
    	let current;
    	buttonsdemo = new ButtonsDemo({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(buttonsdemo.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(buttonsdemo, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(buttonsdemo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(buttonsdemo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(buttonsdemo, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5.name,
    		type: "slot",
    		source: "(53:12) <Route single match=\\\"buttons\\\" breadcrumb=\\\"buttons\\\">",
    		ctx
    	});

    	return block;
    }

    // (57:12) <Route single match="form" breadcrumb="form">
    function create_default_slot_4(ctx) {
    	let formdemo;
    	let current;
    	formdemo = new FormDemo({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(formdemo.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(formdemo, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(formdemo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(formdemo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(formdemo, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(57:12) <Route single match=\\\"form\\\" breadcrumb=\\\"form\\\">",
    		ctx
    	});

    	return block;
    }

    // (61:12) <Route single match="buttons-place" breadcrumb="Buttons Place">
    function create_default_slot_3(ctx) {
    	let buttonsplacedemo;
    	let current;
    	buttonsplacedemo = new ButtonsPlaceDemo({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(buttonsplacedemo.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(buttonsplacedemo, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(buttonsplacedemo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(buttonsplacedemo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(buttonsplacedemo, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(61:12) <Route single match=\\\"buttons-place\\\" breadcrumb=\\\"Buttons Place\\\">",
    		ctx
    	});

    	return block;
    }

    // (65:12) <Route single match="*" let:router>
    function create_default_slot_2(ctx) {
    	let t_value = /*router*/ ctx[2].star + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*router*/ 4 && t_value !== (t_value = /*router*/ ctx[2].star + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(65:12) <Route single match=\\\"*\\\" let:router>",
    		ctx
    	});

    	return block;
    }

    // (43:8) <Cell size="1" block style="align-self: flex-start">
    function create_default_slot_1$1(ctx) {
    	let route0;
    	let t0;
    	let route1;
    	let t1;
    	let route2;
    	let t2;
    	let route3;
    	let t3;
    	let route4;
    	let t4;
    	let route5;
    	let current;

    	route0 = new Router({
    			props: {
    				single: true,
    				match: "panel",
    				breadcrumb: "panels",
    				$$slots: { default: [create_default_slot_7] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route1 = new Router({
    			props: {
    				single: true,
    				match: "rowcell",
    				breadcrumb: "rowcell",
    				$$slots: { default: [create_default_slot_6] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route2 = new Router({
    			props: {
    				single: true,
    				match: "buttons",
    				breadcrumb: "buttons",
    				$$slots: { default: [create_default_slot_5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route3 = new Router({
    			props: {
    				single: true,
    				match: "form",
    				breadcrumb: "form",
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route4 = new Router({
    			props: {
    				single: true,
    				match: "buttons-place",
    				breadcrumb: "Buttons Place",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route5 = new Router({
    			props: {
    				single: true,
    				match: "*",
    				$$slots: {
    					default: [
    						create_default_slot_2,
    						({ router }) => ({ 2: router }),
    						({ router }) => router ? 4 : 0
    					]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(route0.$$.fragment);
    			t0 = space();
    			create_component(route1.$$.fragment);
    			t1 = space();
    			create_component(route2.$$.fragment);
    			t2 = space();
    			create_component(route3.$$.fragment);
    			t3 = space();
    			create_component(route4.$$.fragment);
    			t4 = space();
    			create_component(route5.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(route0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(route1, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(route2, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(route3, target, anchor);
    			insert_dev(target, t3, anchor);
    			mount_component(route4, target, anchor);
    			insert_dev(target, t4, anchor);
    			mount_component(route5, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const route0_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				route0_changes.$$scope = { dirty, ctx };
    			}

    			route0.$set(route0_changes);
    			const route1_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				route1_changes.$$scope = { dirty, ctx };
    			}

    			route1.$set(route1_changes);
    			const route2_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				route2_changes.$$scope = { dirty, ctx };
    			}

    			route2.$set(route2_changes);
    			const route3_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				route3_changes.$$scope = { dirty, ctx };
    			}

    			route3.$set(route3_changes);
    			const route4_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				route4_changes.$$scope = { dirty, ctx };
    			}

    			route4.$set(route4_changes);
    			const route5_changes = {};

    			if (dirty & /*$$scope, router*/ 68) {
    				route5_changes.$$scope = { dirty, ctx };
    			}

    			route5.$set(route5_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			transition_in(route2.$$.fragment, local);
    			transition_in(route3.$$.fragment, local);
    			transition_in(route4.$$.fragment, local);
    			transition_in(route5.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(route3.$$.fragment, local);
    			transition_out(route4.$$.fragment, local);
    			transition_out(route5.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(route0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(route1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(route2, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(route3, detaching);
    			if (detaching) detach_dev(t3);
    			destroy_component(route4, detaching);
    			if (detaching) detach_dev(t4);
    			destroy_component(route5, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$1.name,
    		type: "slot",
    		source: "(43:8) <Cell size=\\\"1\\\" block style=\\\"align-self: flex-start\\\">",
    		ctx
    	});

    	return block;
    }

    // (29:4) <Row>
    function create_default_slot$1(ctx) {
    	let cell0;
    	let t;
    	let cell1;
    	let current;

    	cell0 = new Cell({
    			props: {
    				style: "align-self: flex-start",
    				$$slots: { default: [create_default_slot_8] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	cell1 = new Cell({
    			props: {
    				size: "1",
    				block: true,
    				style: "align-self: flex-start",
    				$$slots: { default: [create_default_slot_1$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(cell0.$$.fragment);
    			t = space();
    			create_component(cell1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(cell0, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(cell1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const cell0_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				cell0_changes.$$scope = { dirty, ctx };
    			}

    			cell0.$set(cell0_changes);
    			const cell1_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				cell1_changes.$$scope = { dirty, ctx };
    			}

    			cell1.$set(cell1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cell0.$$.fragment, local);
    			transition_in(cell1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cell0.$$.fragment, local);
    			transition_out(cell1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(cell0, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(cell1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(29:4) <Row>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div1;
    	let div0;
    	let t;
    	let row;
    	let current;
    	let each_value = /*$breadCrumb*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	row = new Row({
    			props: {
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			create_component(row.$$.fragment);
    			add_location(div0, file, 17, 4, 653);
    			attr_dev(div1, "class", "sre-container demo svelte-1gxzqlc");
    			add_location(div1, file, 16, 0, 616);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div1, t);
    			mount_component(row, div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$breadCrumb*/ 1) {
    				each_value = /*$breadCrumb*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div0, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			const row_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    			destroy_component(row);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $breadCrumb;
    	validate_store(breadCrumb, 'breadCrumb');
    	component_subscribe($$self, breadCrumb, $$value => $$invalidate(0, $breadCrumb = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Demo', slots, []);
    	let btnDisabled = false;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Demo> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Route: Router,
    		breadCrumb,
    		Panel,
    		Row,
    		Cell,
    		A,
    		Button,
    		FormDemo,
    		ButtonsDemo,
    		RowCellDemo,
    		PanelDemo,
    		ButtonsPlaceDemo,
    		btnDisabled,
    		$breadCrumb
    	});

    	$$self.$inject_state = $$props => {
    		if ('btnDisabled' in $$props) btnDisabled = $$props.btnDisabled;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [$breadCrumb];
    }

    class Demo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Demo",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.44.2 */

    // (7:4) <Route match="demo" breadcrumb="demo">
    function create_default_slot_1(ctx) {
    	let demo;
    	let current;
    	demo = new Demo({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(demo.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(demo, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(demo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(demo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(demo, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(7:4) <Route match=\\\"demo\\\" breadcrumb=\\\"demo\\\">",
    		ctx
    	});

    	return block;
    }

    // (6:0) <Route match="/" breadcrumb="Arxh">
    function create_default_slot(ctx) {
    	let route;
    	let current;

    	route = new Router({
    			props: {
    				match: "demo",
    				breadcrumb: "demo",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(route.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(route, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const route_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				route_changes.$$scope = { dirty, ctx };
    			}

    			route.$set(route_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(route, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(6:0) <Route match=\\\"/\\\" breadcrumb=\\\"Arxh\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let route;
    	let current;

    	route = new Router({
    			props: {
    				match: "/",
    				breadcrumb: "Arxh",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(route.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(route, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const route_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				route_changes.$$scope = { dirty, ctx };
    			}

    			route.$set(route_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(route, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Route: Router, Demo });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    window.dd = console.log;

    const app = new App({
    	target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
