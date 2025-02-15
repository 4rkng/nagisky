import { del, get, set } from '@/scripts/idb-proxy';
import { reactive } from 'vue';
import * as misskey from 'misskey-js';
import { apiUrl } from '@/config';
import { waiting, api, popup, popupMenu, success } from '@/os';
import { unisonReload, reloadChannel } from '@/scripts/unison-reload';
import { showSuspendedDialog } from './scripts/show-suspended-dialog';
import { i18n } from './i18n';

// TODO: 他のタブと永続化されたstateを同期

type Account = misskey.entities.MeDetailed;

const data = localStorage.getItem('account');

// TODO: 外部からはreadonlyに
export const $i = data ? reactive(JSON.parse(data) as Account) : null;

export async function signout() {
	waiting();
	localStorage.removeItem('account');

	//#region Remove account
	const accounts = await getAccounts();
	accounts.splice(accounts.findIndex(x => x.id === $i.id), 1);

	if (accounts.length > 0) await set('accounts', accounts);
	else await del('accounts');
	//#endregion

	//#region Remove service worker registration
	try {
		if (navigator.serviceWorker.controller) {
			const registration = await navigator.serviceWorker.ready;
			const push = await registration.pushManager.getSubscription();
			if (push) {
				await fetch(`${apiUrl}/sw/unregister`, {
					method: 'POST',
					body: JSON.stringify({
						i: $i.token,
						endpoint: push.endpoint,
					}),
				});
			}
		}

		if (accounts.length === 0) {
			await navigator.serviceWorker.getRegistrations()
				.then(registrations => {
					return Promise.all(registrations.map(registration => registration.unregister()));
				});
		}
	} catch (e) {}
	//#endregion

	document.cookie = `igi=; path=/`;

	if (accounts.length > 0) login(accounts[0].token);
	else unisonReload('/');
}

export async function getAccounts(): Promise<{ id: Account['id'], token: Account['token'] }[]> {
	return (await get('accounts')) || [];
}

export async function addAccount(id: Account['id'], token: Account['token']) {
	const accounts = await getAccounts();
	if (!accounts.some(x => x.id === id)) {
		await set('accounts', accounts.concat([{ id, token }]));
	}
}

function fetchAccount(token): Promise<Account> {
	return new Promise((done, fail) => {
		// Fetch user
		fetch(`${apiUrl}/i`, {
			method: 'POST',
			body: JSON.stringify({
				i: token
			})
		})
		.then(res => res.json())
		.then(res => {
			if (res.error) {
				if (res.error.id === 'a8c724b3-6e9c-4b46-b1a8-bc3ed6258370') {
					showSuspendedDialog().then(() => {
						signout();
					});
				} else {
					signout();
				}
			} else {
				res.token = token;
				done(res);
			}
		})
		.catch(fail);
	});
}

export function updateAccount(data) {
	for (const [key, value] of Object.entries(data)) {
		$i[key] = value;
	}
	localStorage.setItem('account', JSON.stringify($i));
}

export function refreshAccount() {
	return fetchAccount($i.token).then(updateAccount);
}

export async function login(token: Account['token'], redirect?: string) {
	waiting();
	if (_DEV_) console.log('logging as token ', token);
	const me = await fetchAccount(token);
	localStorage.setItem('account', JSON.stringify(me));
	await addAccount(me.id, token);

	if (redirect) {
		// 他のタブは再読み込みするだけ
		reloadChannel.postMessage(null);
		// このページはredirectで指定された先に移動
		location.href = redirect;
		return;
	}

	unisonReload();
}

export async function openAccountMenu(ev: MouseEvent) {
	function showSigninDialog() {
		popup(import('@/components/signin-dialog.vue'), {}, {
			done: res => {
				addAccount(res.id, res.i);
				success();
			},
		}, 'closed');
	}

	function createAccount() {
		popup(import('@/components/signup-dialog.vue'), {}, {
			done: res => {
				addAccount(res.id, res.i);
				switchAccountWithToken(res.i);
			},
		}, 'closed');
	}

	async function switchAccount(account: any) {
		const storedAccounts = await getAccounts();
		const token = storedAccounts.find(x => x.id === account.id).token;
		switchAccountWithToken(token);
	}

	function switchAccountWithToken(token: string) {
		login(token);
	}

	const storedAccounts = await getAccounts().then(accounts => accounts.filter(x => x.id !== $i.id));
	const accountsPromise = api('users/show', { userIds: storedAccounts.map(x => x.id) });

	const accountItemPromises = storedAccounts.map(a => new Promise(res => {
		accountsPromise.then(accounts => {
			const account = accounts.find(x => x.id === a.id);
			if (account == null) return res(null);
			res({
				type: 'user',
				user: account,
				action: () => { switchAccount(account); }
			});
		});
	}));

	popupMenu([...[{
		type: 'link',
		text: i18n.locale.profile,
		to: `/@${ $i.username }`,
		avatar: $i,
	}, null, ...accountItemPromises, {
		icon: 'fas fa-plus',
		text: i18n.locale.addAccount,
		action: () => {
			popupMenu([{
				text: i18n.locale.existingAccount,
				action: () => { showSigninDialog(); },
			}, {
				text: i18n.locale.createAccount,
				action: () => { createAccount(); },
			}], ev.currentTarget || ev.target);
		},
	}, {
		type: 'link',
		icon: 'fas fa-users',
		text: i18n.locale.manageAccounts,
		to: `/settings/accounts`,
	}]], ev.currentTarget || ev.target, {
		align: 'left'
	});
}

// このファイルに書きたくないけどここに書かないと何故かVeturが認識しない
declare module '@vue/runtime-core' {
	interface ComponentCustomProperties {
		$i: typeof $i;
	}
}
