# Z_Pilot — Hôtel Zingana

Application web interne de suivi des tâches et de génération des rapports d'activité
(hebdomadaires et mensuels, export Word) d'un département. Référence fonctionnelle :
cahier des charges v1.0 du 8 octobre 2026 (« CDC »), dont les identifiants
(`EF-…`, `RG-…`, `REC-…`) sont repris dans le code.

## Stack

| Domaine          | Choix                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| Framework        | SvelteKit 3, Svelte 5 (runes), TypeScript, Vite 8                              |
| Base de données  | Neon (PostgreSQL), Drizzle ORM + drizzle-kit, driver `pg`                      |
| Authentification | Sessions maison (cookie HttpOnly, jeton haché en SHA-256), argon2id            |
| Formulaires      | Form actions SvelteKit + sveltekit-superforms + Zod                            |
| Interface        | Tailwind CSS 4, icônes `@lucide/svelte`, polices Source Serif 4 et Public Sans |
| Dates            | date-fns + `@date-fns/tz`, fuseau `Africa/Douala`                              |
| Export Word      | `docx`, généré côté serveur                                                    |
| Tests            | Vitest (règles métier), Playwright (parcours)                                  |
| Hébergement      | Vercel (Node 24, région `fra1`), Vercel Cron                                   |

## Prérequis

- Node.js 24 (`engines` est appliqué : `.npmrc` contient `engine-strict=true`).
- Un projet Neon créé dans la région **AWS Europe Central 1 (Frankfurt)**, la plus
  proche de la région Vercel `fra1`. Une branche Neon par environnement
  (développement, préproduction, production).

## Installation

```sh
npm install
cp .env.example .env   # puis renseigner les valeurs
npm run db:migrate     # applique les migrations du dossier drizzle/
npm run dev
```

## Variables d'environnement

Déclarées et validées au démarrage dans [`src/env.ts`](src/env.ts) : l'application
refuse de démarrer, et le build échoue, si une valeur est absente ou invalide.

| Variable                | Rôle                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Chaîne de connexion **poolée** Neon (hôte en `-pooler`), utilisée par l'application.                     |
| `DATABASE_URL_UNPOOLED` | Connexion directe, utilisée par drizzle-kit pour les migrations. Optionnelle : à défaut, `DATABASE_URL`. |
| `CRON_SECRET`           | Au moins 32 caractères (`openssl rand -base64 32`). Vercel Cron l'envoie dans `Authorization: Bearer …`. |

L'intégration Neon de Vercel crée `DATABASE_URL` et `DATABASE_URL_UNPOOLED`
automatiquement, avec une branche par déploiement de préproduction.

## Base de données

Le schéma est défini dans [`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts).
Les règles qui doivent tenir quoi qu'il arrive sont des contraintes en base :
un seul chef actif, semaine identifiée par son lundi, poids de 1 à 3, une seule version
publiée par rapport hebdomadaire, cohérence des tâches quantitatives, etc.

```sh
npm run db:generate   # crée une migration après une modification du schéma
npm run db:migrate    # applique les migrations
npm run db:studio     # explore la base
```

Ne pas utiliser `db:push` sur une base partagée : il modifie le schéma sans migration
versionnée.

## Commandes

| Commande            | Effet                                                       |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Serveur de développement                                    |
| `npm run lint`      | Prettier et ESLint                                          |
| `npm run check`     | Vérification des types (svelte-check)                       |
| `npm run test:unit` | Tests Vitest (mode watch ; `-- --run` pour un seul passage) |
| `npm run test:e2e`  | Build, puis tests Playwright sur Chromium                   |
| `npm run build`     | Build de production (sortie Vercel dans `.vercel/output`)   |

Ordre de contrôle avant livraison : `lint → check → test → build`.

## Déploiement (Vercel)

1. Importer le dépôt dans Vercel (le preset SvelteKit est détecté).
2. Installer l'intégration Neon, ou renseigner `DATABASE_URL` et
   `DATABASE_URL_UNPOOLED` à la main pour chaque environnement.
3. Renseigner `CRON_SECRET` (valeur différente par environnement).
4. Appliquer les migrations sur la branche de production avant de déployer le code
   qui en dépend : `DATABASE_URL_UNPOOLED=… npm run db:migrate`.
5. La tâche planifiée est déclarée dans [`vercel.json`](vercel.json) : `/api/cron/daily`,
   tous les jours à 15:00 UTC (16:00 à Douala). La route décide elle-même si le jour est
   ouvré, selon les paramètres de l'application. Sur le plan gratuit, l'heure
   d'exécution est approximative (à l'heure près).

Retour arrière : redéployer le déploiement précédent depuis Vercel. Une migration
déjà appliquée ne se défait pas automatiquement : restaurer la branche Neon à un
point antérieur si nécessaire.

## Structure

```
drizzle/                  migrations SQL versionnées
src/env.ts                déclaration et validation des variables d'environnement
src/lib/domain/           règles métier pures, testées (semaines ISO, rattachement au mois…)
src/lib/server/db/        client et schéma Drizzle (serveur uniquement)
src/lib/assets/brand/     logo et marque Z_Pilot
src/routes/               pages et endpoints
src/routes/api/cron/      tâches planifiées
vercel.json               déclaration du cron
```

Imports internes : l'alias `#lib` (subpath imports Node, déclaré dans `package.json`)
remplace `$lib` dans SvelteKit 3.
