<script context="module">
    const isValidEmail = v => /[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}/.test(`${v}`);
    const isNumber = v => /[0-9]+/.test(`${v}`);


    export const parseRules = p => {
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

    export const validateItem = (rules, text) => {
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

</script>


<script>
    let classList = '';
    export let valid = true;
    export let live = false;
    export {classList as class};

    export const updateElementValidity = v => {
        valid = valid && v;
    };

    let callbacks = [];

    export const registerCheckCallback = callback => {
        callbacks.push(callback);
    };

    export const unregisterCheckCallback = callback => {
        callbacks = callbacks.filter(x => x != callback);
    };

    export const checkValidity = () => {
        valid = true;
        live = true;
        callbacks.map(cb => cb(true));
        return valid;
    };

    $: valid = live ? valid : null;

</script>

<svelte:options accessors/>

<div class="form {classList}">
    <slot/>
</div>


<style>
    .form :global(.label) {
        color: var(--label-color);
    }

    .form :global(.sre-form-help) {
        font-size: 14px;
        color: #999;
    }

    .form :global(.sre-input-error) {
        border: 1px solid var(--error-color) !important;
    }

    .form :global(.sre-form-error) {
        color: var(--error-color) !important;
    }
</style>