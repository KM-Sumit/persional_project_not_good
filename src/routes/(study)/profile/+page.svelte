<script lang="ts">
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>You</title>
</svelte:head>

<div class="flex flex-col gap-8">
	<header class="flex flex-col gap-1">
		<h1 class="font-display text-[1.75rem] leading-tight font-extrabold tracking-tight sm:text-[2rem]">
			{data.user.name}
		</h1>
		<p class="meta text-[15px]">{data.user.email}</p>
		<p class="meta">{data.user.role === 'admin' ? 'Administrator' : 'Student'}</p>
	</header>

	<section class="flex items-center justify-between gap-3 card !p-4">
		<div>
			<p class="text-[13px] font-bold">Appearance</p>
			<p class="meta mt-0.5">Light or dark — also in the sidebar and app bar.</p>
		</div>
		<ThemeToggle />
	</section>

	<section class="flex flex-col gap-3">
		{#if data.user.role === 'admin'}
			<a class="btn-primary no-underline" href="/admin">Open admin studio</a>
		{/if}
		<form method="POST" action="/api/auth/logout">
			<button class="btn-quiet w-full" type="submit">Log out</button>
		</form>
	</section>

	<section>
		<div class="section-head">
			<h2>Inbox</h2>
		</div>
		{#if data.inbox.length === 0}
			<p class="meta">No notices yet. Studio messages will show up here.</p>
		{:else}
			<div class="flex flex-col gap-3">
				{#each data.inbox as item (item.id)}
					<article class="card flex flex-col gap-2">
						<h3 class="text-[15px] font-semibold">{item.title}</h3>
						<p class="whitespace-pre-wrap text-[14px] leading-relaxed">{item.body}</p>
						{#if !item.read}
							<form method="POST" action="?/read">
								<button class="btn-quiet" type="submit" name="notificationId" value={item.id}>
									Mark read
								</button>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>
</div>
