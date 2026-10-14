import { eq, sql } from 'drizzle-orm';
import { recordAudit } from '#lib/server/audit.js';
import { settings } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';

export interface AppSettings {
	organizationName: string;
	departmentName: string | null;
	primaryColor: string;
	workingDays: number[];
	sessionDurationDays: number;
	hasCustomLogo: boolean;
	logoMimeType: string | null;
	updatedAt: Date;
}

export interface UpdateSettingsInput {
	organizationName: string;
	departmentName?: string | null;
	primaryColor: string;
	workingDays: number[];
	sessionDurationDays: number;
}

export interface LogoUpload {
	buffer: Buffer;
	mimeType: string;
}

/** EF-EXP-04 / EF-AUT-02 / RG-01: retrieves current application settings. */
export async function getSettings(db: Database): Promise<AppSettings> {
	const [row] = await db
		.select({
			organizationName: settings.organizationName,
			departmentName: settings.departmentName,
			primaryColor: settings.primaryColor,
			workingDays: settings.workingDays,
			sessionDurationDays: settings.sessionDurationDays,
			hasCustomLogo: sql<boolean>`${settings.logo} is not null`,
			logoMimeType: settings.logoMimeType,
			updatedAt: settings.updatedAt
		})
		.from(settings)
		.where(eq(settings.id, 1));

	if (!row) throw new Error('Settings row missing: ensure migrations ran.');
	return row;
}

/** Serves the uploaded organization logo if present. */
export async function getLogo(db: Database): Promise<LogoUpload | null> {
	const [row] = await db
		.select({
			logo: settings.logo,
			logoMimeType: settings.logoMimeType
		})
		.from(settings)
		.where(eq(settings.id, 1));

	if (!row || !row.logo || !row.logoMimeType) return null;
	return {
		buffer: row.logo,
		mimeType: row.logoMimeType
	};
}

/**
 * Updates application settings inside a transaction and records an audit trail
 * of modified fields (EF-EXP-04, EF-AUT-02, CDC §10).
 */
export async function updateSettings(
	db: Database,
	actorId: string,
	input: UpdateSettingsInput,
	options: {
		newLogo?: LogoUpload | null;
		removeLogo?: boolean;
	} = {}
): Promise<void> {
	await db.transaction(async (tx) => {
		const [current] = await tx
			.select({
				organizationName: settings.organizationName,
				departmentName: settings.departmentName,
				primaryColor: settings.primaryColor,
				workingDays: settings.workingDays,
				sessionDurationDays: settings.sessionDurationDays,
				hasLogo: sql<boolean>`${settings.logo} is not null`
			})
			.from(settings)
			.where(eq(settings.id, 1))
			.for('update');

		if (!current) throw new Error('Settings row missing.');

		const changes: Record<string, { from: unknown; to: unknown }> = {};

		if (current.organizationName !== input.organizationName) {
			changes.organizationName = { from: current.organizationName, to: input.organizationName };
		}
		if ((current.departmentName ?? null) !== (input.departmentName ?? null)) {
			changes.departmentName = { from: current.departmentName, to: input.departmentName ?? null };
		}
		if (current.primaryColor.toLowerCase() !== input.primaryColor.toLowerCase()) {
			changes.primaryColor = { from: current.primaryColor, to: input.primaryColor };
		}

		// Sort arrays to compare content
		const currentDaysSorted = [...current.workingDays].sort();
		const inputDaysSorted = [...input.workingDays].sort();
		const daysChanged =
			currentDaysSorted.length !== inputDaysSorted.length ||
			!currentDaysSorted.every((day, idx) => day === inputDaysSorted[idx]);

		if (daysChanged) {
			changes.workingDays = { from: current.workingDays, to: inputDaysSorted };
		}

		if (current.sessionDurationDays !== input.sessionDurationDays) {
			changes.sessionDurationDays = {
				from: current.sessionDurationDays,
				to: input.sessionDurationDays
			};
		}

		let logoUpdate: { logo?: Buffer | null; logoMimeType?: string | null } = {};

		if (options.removeLogo) {
			if (current.hasLogo) {
				changes.logo = { from: 'custom', to: 'default' };
				logoUpdate = { logo: null, logoMimeType: null };
			}
		} else if (options.newLogo) {
			changes.logo = { from: current.hasLogo ? 'custom' : 'default', to: 'custom' };
			logoUpdate = { logo: options.newLogo.buffer, logoMimeType: options.newLogo.mimeType };
		}

		if (Object.keys(changes).length === 0) return;

		await tx
			.update(settings)
			.set({
				organizationName: input.organizationName,
				departmentName: input.departmentName ?? null,
				primaryColor: input.primaryColor,
				workingDays: inputDaysSorted,
				sessionDurationDays: input.sessionDurationDays,
				...logoUpdate
			})
			.where(eq(settings.id, 1));

		await recordAudit(tx, {
			actorId,
			action: 'settings.updated',
			entity: 'settings',
			entityId: '1',
			details: { changes }
		});
	});
}
