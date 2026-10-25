<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { toast } from '#lib/components/ui';

	let { data } = $props();
</script>

<svelte:head><title>Connect Us · UCI</title></svelte:head>

<PageHeader
	title="Connect Us"
	subtitle="These links open from the Connect Us button on the student home page."
	crumbs={[{ href: '/admin', label: 'Dashboard' }]}
/>

<form
	class="card card-pad stack max-w-xl"
	method="POST"
	use:enhance={() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') toast('Links saved');
			else if (result.type === 'failure') toast(String(result.data?.message ?? 'Check the links.'), 'error');
		}}
>
	<div class="field">
		<label class="label" for="youtube">YouTube channel</label>
		<input id="youtube" class="input" name="youtube" value={data.links.youtube} placeholder="https://www.youtube.com/@yourchannel" />
	</div>
	<div class="field">
		<label class="label" for="instagram">Instagram</label>
		<input id="instagram" class="input" name="instagram" value={data.links.instagram} placeholder="https://www.instagram.com/yourpage" />
	</div>
	<div class="field">
		<label class="label" for="facebook">Facebook</label>
		<input id="facebook" class="input" name="facebook" value={data.links.facebook} placeholder="https://www.facebook.com/yourpage" />
	</div>
	<div class="field">
		<label class="label" for="whatsapp">WhatsApp</label>
		<input id="whatsapp" class="input" name="whatsapp" value={data.links.whatsapp} placeholder="https://wa.me/91XXXXXXXXXX or 9876543210" />
		<p class="help">Paste a chat link, or a 10-digit mobile number.</p>
	</div>
	<button class="btn btn-primary">Save links</button>
</form>
