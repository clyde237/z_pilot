// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionUser } from '#lib/domain/roles.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Set by hooks.server.ts for every request; null when signed out. */
			user: SessionUser | null;
			sessionId: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
