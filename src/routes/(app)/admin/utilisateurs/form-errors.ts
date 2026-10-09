import { message, setError, type SuperValidated } from 'sveltekit-superforms';
import type { UserFormMessage } from '#lib/components/users/UserForm.svelte';
import type { UserFormInput } from '#lib/schemas/users.js';
import type { AccountError } from '#lib/server/users.js';

/** Shows a refusal of the account service next to its field, or above the form. */
export function accountErrorResponse(
	form: SuperValidated<UserFormInput, UserFormMessage>,
	accountError: AccountError
) {
	return accountError.field && accountError.field !== 'active'
		? setError(form, accountError.field, accountError.message)
		: message(form, { tone: 'danger', text: accountError.message }, { status: 400 });
}
