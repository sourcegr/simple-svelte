<script>
	let className='';
	export let style="";
	export {className as class};
    export let block = false;

	export let size="none";
</script>

<div class:block style="flex:{size};{style}" class="cell { className }"><slot /></div>

<style>
	div.cell:not(.block) {
		display: flex;
		align-self: stretch;
	}
</style>
