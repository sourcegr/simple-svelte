import App from './App.svelte';
window.dd = console.log;

const app = new App({
	target: document.body,
});

export default app;
