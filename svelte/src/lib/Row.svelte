<script>
let className='';
export let style="";
export {className as class};
</script>

<div {style} class={className}><slot /></div>

<style>
	div {
		display:flex;
		align-items: center
	}
</style>
