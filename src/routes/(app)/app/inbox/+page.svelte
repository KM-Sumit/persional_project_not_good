<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Bell, BellRing, ChevronRight, MessageCircleQuestion } from '@lucide/svelte';
	import type { SubmitFunction } from './$types';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { toast } from '#lib/components/ui';
	import { ago } from '#lib/features/courses/components/format';

	let { data } = $props();
	const unread = $derived(data.page.items.filter((i) => !i.read).length);

	const open: SubmitFunction = () => async ({ result, update }) => {
		if (result.type === 'redirect') {
			if (/^https?:/.test(result.location)) window.location.href = result.location;
			else await goto(result.location, { invalidateAll: true });
		} else await update();
	};
</script>

<svelte:head><title>Inbox · UCI</title></svelte:head>

<div class="page-narrow pb-10">
	<header class="page-head">
		<div class="min-w-0">
			<h1 class="page-title">Inbox</h1>
			<p class="page-sub">{unread ? `${unread} unread` : 'You are all caught up.'}</p>
		</div>
		{#if unread}
			<form
				method="POST"
				action="?/readAll"
				class="page-actions"
				use:enhance={() =>
					async ({ update }) => {
						await update({ invalidateAll: true });
						toast('All marked as read');
					}}
			>
				<button class="btn btn-secondary btn-sm">Mark all read</button>
			</form>
		{/if}
	</header>

	{#if data.answers}
		<a class="list mb-4 block rise" href="/app/doubts">
			<span class="list-row">
				<span class="leading-icon"><MessageCircleQuestion /></span>
				<span class="grow">
					<span class="title block">{data.answers} new {data.answers === 1 ? 'answer' : 'answers'} to your doubts</span>
					<span class="meta block">Open Doubts to read {data.answers === 1 ? 'it' : 'them'}</span>
				</span>
				<ChevronRight class="chev" />
			</span>
		</a>
	{/if}

	{#if data.page.items.length}
		<ul class="list rise" style="--i: 1">
			{#each data.page.items as n (n.id)}
				<li>
					<form method="POST" action="?/open" use:enhance={open}>
						<input type="hidden" name="id" value={n.id} />
						{#if n.href}<input type="hidden" name="href" value={n.href} />{/if}
						<button class="list-row note" class:is-unread={!n.read} disabled={n.read && !n.href}>
							<span class="leading-icon">{#if n.read}<Bell />{:else}<BellRing />{/if}</span>
							<span class="grow">
								<span class="title block">{n.title}</span>
								{#if n.body}<span class="meta block body">{n.body}</span>{/if}
								<span class="tiny muted block mt-1">{ago(n.createdAt, data.now)}{!n.read ? ' · new' : ''}</span>
							</span>
							{#if n.href}<ChevronRight class="chev" />{/if}
						</button>
					</form>
				</li>
			{/each}
		</ul>
		{#if data.page.next}
			<div class="mt-4 text-center"><a class="btn btn-secondary" href="?cursor={encodeURIComponent(data.page.next)}">Older messages</a></div>
		{/if}
	{:else}
		<EmptyState icon={Bell} title="No messages yet" body="Test schedules, results and announcements from UCI land here." />
	{/if}
</div>

<style>
	.note {
		width: 100%;
		text-align: left;
		position: relative;
		align-items: flex-start;
	}
	.note:disabled {
		cursor: default;
		opacity: 1;
	}
	.note .body {
		white-space: pre-line;
	}
	.note:not(.is-unread) .title {
		font-weight: 500;
	}
	.note.is-unread::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.75rem;
		bottom: 0.75rem;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: hsl(var(--sun));
	}
</style>
