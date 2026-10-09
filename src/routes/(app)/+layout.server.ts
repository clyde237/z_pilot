import { requireUser } from '#lib/server/auth/access.js';
import type { LayoutServerLoad } from './$types';

// Only the session fields: never the password hash or the lock state.
export const load: LayoutServerLoad = ({ locals }) => ({ user: requireUser(locals) });
