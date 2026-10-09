-- The settings table holds exactly one row (id = 1, see constraint settings_singleton).
-- Creating it here lets the application read settings without an upsert.
INSERT INTO "settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
