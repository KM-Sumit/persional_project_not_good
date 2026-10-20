<script lang="ts">
	import { enhance } from '$app/forms';
	import { ShieldCheck, UserMinus, UserPlus } from '@lucide/svelte';
	import { Badge, EmptyState, PageHeader } from '#lib/components/ui';
	import Picker from '#lib/components/kit/Picker.svelte';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import { toasting } from '../students/_enhance';

	let { data } = $props();
	type Person = (typeof data.staff)[number];

	const roleOptions = [
		{ value: 'admin', label: 'Admin', hint: 'Everything, plus team and settings' },
		{ value: 'teacher', label: 'Teacher', hint: 'Content, tests and students' }
	];
	let addRole = $state<string | null>('teacher');
	let removing = $state<Person | null>(null);
	let removeOpen = $state(false);
	let removeForm = $state<HTMLFormElement>();
	const adminCount = $derived(data.staff.filter((p) => p.role === 'admin' && !p.suspended).length);

	function submitRole(e: Event) {
		(e.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}
</script>

<div class="page">
	<PageHeader title="Team & roles" subtitle="Admins manage everything. Teachers manage content, tests and students." />

	<div class="cols">
		<section class="rise">
			<div class="section-head"><h2 class="section-title">Staff</h2><span class="small muted font-mono tabular">{data.staff.length}</span></div>
			{#if data.staff.length}
				<div class="list">
					{#each data.staff as p (p.id)}
						{@const lastAdmin = p.role === 'admin' && adminCount <= 1}
						<div class="list-row">
							<span class="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
							<span class="grow">
								<span class="title block">{p.name}{#if p.id === data.me}<span class="muted font-normal">&nbsp;(you)</span>{/if}</span>
								<span class="meta block">{p.email}</span>
							</span>
							{#if p.suspended}<Badge tone="danger">Suspended</Badge>{/if}
							<form method="POST" action="?/role" use:enhance={toasting()}>
								<input type="hidden" name="id" value={p.id} />
								<select class="input role" name="role" value={p.role} onchange={submitRole} disabled={lastAdmin} aria-label="Role for {p.name}" title={lastAdmin ? 'The last admin cannot be changed' : undefined}>
									<option value="admin">Admin</option>
									<option value="teacher">Teacher</option>
								</select>
							</form>
							{#if !lastAdmin}
								<button class="icon-btn icon-btn-sm" aria-label="Remove {p.name} from the team" title="Remove from team" onclick={() => ((removing = p), (removeOpen = true))}><UserMinus /></button>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="card"><EmptyState compact icon={ShieldCheck} title="No staff yet" /></div>
			{/if}
		</section>

		<section class="rise" style="--i: 1">
			<div class="section-head"><h2 class="section-title">Add a team member</h2></div>
			<form class="card card-pad stack" method="POST" action="?/add" use:enhance={toasting()}>
				<div class="field"><label class="label" for="t-email">Google email</label><input id="t-email" class="input" type="email" name="email" required placeholder="teacher@gmail.com" autocomplete="off" /></div>
				<div class="field"><span class="label">Role</span><Picker bind:value={addRole} name="role" options={roleOptions} label="Role" /></div>
				<p class="help">They need to sign in once with this Google account first. Pending invites are not supported yet.</p>
				<button class="btn btn-primary"><UserPlus /> Add to team</button>
			</form>
		</section>
	</div>
</div>

<form bind:this={removeForm} method="POST" action="?/role" hidden use:enhance={toasting()}>
	<input type="hidden" name="id" value={removing?.id ?? ''} />
	<input type="hidden" name="role" value="student" />
</form>
<ConfirmSheet
	bind:open={removeOpen}
	title="Remove {removing?.name ?? ''} from the team?"
	body="They become a student and lose access to the staff console. They are signed out now."
	confirmLabel="Remove from team"
	danger
	onconfirm={() => removeForm?.requestSubmit()}
/>

<style>
	.cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
	@media (min-width: 1024px) { .cols { grid-template-columns: 3fr 2fr; align-items: start; } }
	.role { width: auto; min-height: 40px; padding-block: 0; }
</style>
