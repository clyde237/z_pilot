# Z_Pilot — Hôtel Zingana

Application web interne d’excellence pour le pilotage des objectifs, le suivi hebdomadaire des tâches et la génération automatisée des rapports d’activité (hebdomadaires et mensuels consolidés avec export Word `.docx`) pour l’Hôtel Zingana (Bafoussam, Cameroun).

Conçue et développée conformément au **cahier des charges v1.0 du 8 octobre 2026 (« CDC »)**, dont l’ensemble des exigences fonctionnelles (`EF-…`), règles de gestion (`RG-…`) et critères de recette (`REC-…`) sont rigoureusement respectés et testés.

---

## 🏗️ Architecture & Technologies

| Domaine                    | Solution retenue                              | Justification technique & CDC                                                   |
| :------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------ |
| **Framework Fullstack**    | SvelteKit 2 / Svelte 5 (Runes), TypeScript    | Réactivité native, typage strict, SSR haute performance                         |
| **Base de données**        | Neon Serverless PostgreSQL                    | PostgreSQL managé, branches d’environnements, pooling pgbouncer                 |
| **ORM & Migrations**       | Drizzle ORM + Drizzle Kit, driver `pg`        | Typage de bout en bout, migrations SQL versionnées, contraintes DB strictes     |
| **Sécurité & Auth**        | Argon2id (`@node-rs/argon2`), sessions maison | Hachage sécurisé, cookies `HttpOnly`/`SameSite=Lax`, jetons SHA-256             |
| **Interface & Design**     | Tailwind CSS v4, Lucide Icons, Mobile-first   | Design responsive ergonomique (accessible téléphone / desktop), palette Zingana |
| **Fuseau horaire & Dates** | `date-fns`, `@date-fns/tz` (`Africa/Douala`)  | Norme ISO 8601 (semaine du lundi au dimanche, règle du mercredi pour le mois)   |
| **Export Bureautique**     | `docx` (génération serveur native)            | Documents Word `.docx` modifiables, conformes à la charte graphique §6.3        |
| **Automatisation (Cron)**  | Endpoint Vercel Cron `/api/cron/daily`        | Rappels quotidiens (16h Douala) et alertes de clôture le vendredi               |
| **Tests & Qualité**        | Vitest (in-memory PGlite), Playwright         | 19 fichiers de test, 115 tests unitaires & d’intégration (100% succès)          |

---

## 📋 Matrice des Lots Réalisés

- [x] **Lot 0 : Mise en place** — Architecture SvelteKit 2, Tailwind v4, Drizzle ORM, Neon PostgreSQL, structure de base.
- [x] **Lot 1 : Accès et utilisateurs** — Authentification, sessions sécurisées, RBAC (Admin, Chef, Membre), changement de mot de passe forcé, verrouillage après 5 échecs, journal d'audit complet.
- [x] **Lot 2 : Objectifs et espace membre** — Attribution de tâches par le chef (qualitatives et quantitatives avec poids de 1 à 3), pointage par les membres, calcul de progression RG-03, notes et difficultés.
- [x] **Lot 3 : Tableau de bord et rapports hebdomadaires** — Vue synthétique d'équipe, agrégation des avancements, publication de rapports figés (instantané JSON snapshot), consultation membre, réouverture motivée avec historique.
- [x] **Lot 4 : Export Word hebdomadaire** — Générateur `.docx` natif côté serveur conforme au modèle §6.1 et §6.3, personnalisation (organisation, logo, couleur primaire).
- [x] **Lot 5 : Rapport mensuel et consolidation** — Règle du mercredi (RG-01/CDC §5.2), pré-contrôle de complétude, génération de synthèse assistée par gabarits, matrice mensuelle de l'équipe, export Word `.docx` mensuel.
- [x] **Lot 6 : Notifications et automatisation** — Centre de notifications in-app avec badge dynamique, rappels quotidiens d'inactivité, alertes au chef le vendredi et en fin de mois, endpoint cron `/api/cron/daily`.
- [x] **Lot 7 : Recette et mise en production** — Suite complète de tests de recette (REC-01 à REC-10), script d'amorçage de démonstration (`seed-demo.ts`), documentation exhaustive de déploiement et d'exploitation.

---

## 👥 Comptes de Démonstration & Recette

Exécutez `npm run seed:demo` pour initialiser la base avec des données complètes et réalistes de l’Hôtel Zingana :

| Rôle                        | Identifiant     | Mot de passe       | Description / Droits                                                                                          |
| :-------------------------- | :-------------- | :----------------- | :------------------------------------------------------------------------------------------------------------ |
| **Administrateur**          | `admin`         | `Admin1234!`       | Gestion des utilisateurs, paramètres organisationnels, journal d'audit.                                       |
| **Chef de Département**     | `chef.zingana`  | `Chef1234!`        | Clyde Fanche : assignation des tâches, validation, publication et réouverture des rapports hebdo et mensuels. |
| **Membre (Réception)**      | `jean.dupont`   | `Member1234!`      | Jean Dupont : pointage quotidien des tâches de réception et saisie des difficultés.                           |
| **Membre (Gouvernante)**    | `marie.ngono`   | `Member1234!`      | Marie Ngono : pointage des tâches d'étage et des inspections de chambres.                                     |
| **Membre (Maintenance)**    | `alain.fotso`   | `Member1234!`      | Alain Fotso : pointage des maintenances préventives et curatives.                                             |
| **Stagiaire (Test REC-01)** | `sophie.ebelle` | `TempPassword123!` | Compte neuf avec changement obligatoire de mot de passe à la première connexion.                              |

---

## 🧪 Validation des Critères de Recette (CDC §12)

La suite de tests automatisée `src/lib/server/recette.spec.ts` valide intégralement les 10 scénarios de recette du cahier des charges :

| Réf.       | Scénario                                                    | Résultat vérifié par test automatique                                                                                                |   Statut    |
| :--------- | :---------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- | :---------: |
| **REC-01** | Création d'un membre puis première connexion                | Changement de mot de passe imposé avant tout accès à l'application (`mustChangePassword: true`).                                     | ✅ Conforme |
| **REC-02** | Création de 3 tâches (poids 2, 3, 1) ; pointage d'une tâche | Progression = somme des poids réalisés / total $\times 100$, arrondie à l'entier (RG-03). Affiche « Aucun objectif défini » si vide. | ✅ Conforme |
| **REC-03** | Tentative d'accès à l'espace d'un autre membre ou page chef | Accès refusé côté serveur (403/401), modification interdite (`RG-04`, `RG-07`).                                                      | ✅ Conforme |
| **REC-04** | Publication du rapport hebdomadaire par le chef             | Rapport figé (snapshot JSON), tâches verrouillées (`RG-06`), membre notifié (`EF-NOT-04`), consultation lecture seule.               | ✅ Conforme |
| **REC-05** | Modification après publication sans réouverture             | Refus immédiat (`TaskLockedError`). Après réouverture motivée par le chef, version 2 incrémentée à la republication (`RG-11`).       | ✅ Conforme |
| **REC-06** | Export Word d'un rapport hebdomadaire                       | Fichier `.docx` binaire valide (format OpenXML natif), conforme au modèle §6.1, entièrement modifiable sous Word.                    | ✅ Conforme |
| **REC-07** | Rapport mensuel avec semaine à cheval sur deux mois         | Semaine rattachée au bon mois selon la règle du mercredi (`RG-01`), chef inclus (`RG-08`), avertissement si rapports manquants.      | ✅ Conforme |
| **REC-08** | Réinitialisation de mot de passe par l'administrateur       | Mot de passe temporaire affiché une seule fois, changement obligatoire à la connexion suivante (`EF-USR-03`).                        | ✅ Conforme |
| **REC-09** | Exécution de la tâche planifiée quotidienne (Cron)          | Rappel créé pour les membres sans saisie ; alerte de clôture envoyée au chef le vendredi (`EF-NOT-02`, `EF-NOT-03`).                 | ✅ Conforme |
| **REC-10** | Utilisation ergonomique sur téléphone mobile                | Viewport responsive, cibles tactiles $\ge 44$px, aucun défilement horizontal parasite, fuseau `Africa/Douala`.                       | ✅ Conforme |

---

## ⚙️ Installation & Démarrage Local

### Prérequis

- **Node.js 24.x** (exigé dans `package.json` et `.npmrc`).
- Un compte **Neon PostgreSQL** ou une instance PostgreSQL locale.

### 1. Cloner et installer les dépendances

```bash
git clone https://github.com/votre-compte/z_pilot.git
cd z_pilot
npm install
```

### 2. Configurer les variables d'environnement

Copiez `.env.example` en `.env` :

```bash
cp .env.example .env
```

Renseignez les variables nécessaires :

```env
# Chaîne poolée Neon (application runtime)
DATABASE_URL="postgresql://user:password@ep-example-123456-pooler.eu-central-1.aws.neon.tech/z_pilot?sslmode=verify-full"

# Chaîne directe non-poolée (migrations Drizzle)
DATABASE_URL_UNPOOLED="postgresql://user:password@ep-example-123456.eu-central-1.aws.neon.tech/z_pilot?sslmode=verify-full"

# Secret d'authentification pour Vercel Cron
CRON_SECRET="cle_secrete_aleatoire_de_plus_de_32_caracteres"
```

### 3. Appliquer les migrations de base de données

```bash
npm run db:migrate
```

### 4. Amorcer les données de démonstration

```bash
# Données de démonstration Hôtel Zingana (idempotent)
npm run seed:demo

# Pour réinitialiser et repartir d'une base propre :
npm run seed:demo -- --clean
```

### 5. Lancer le serveur de développement

```bash
npm run dev
```

L'application est accessible sur [http://localhost:5173](http://localhost:5173).

---

## 🛠️ Commandes Disponibles

| Commande               | Action                                                                    |
| :--------------------- | :------------------------------------------------------------------------ |
| `npm run dev`          | Lance le serveur local Vite en mode développement.                        |
| `npm run build`        | Compile l'application pour la production (bundle Vercel serverless).      |
| `npm run preview`      | Prévisualise localement le build de production.                           |
| `npm run check`        | Exécute `svelte-check` et la validation TypeScript (0 erreur tolérée).    |
| `npm run lint`         | Vérifie la conformité Prettier et ESLint.                                 |
| `npm run format`       | Applique automatiquement le formatage Prettier sur tout le projet.        |
| `npm run test:unit`    | Lance les 115 tests Vitest avec PostgreSQL in-memory PGlite.              |
| `npm run test`         | Exécute les tests unitaires et d'intégration de recette.                  |
| `npm run seed:demo`    | Amorce la base de données avec l'équipe et les tâches de l'Hôtel Zingana. |
| `npm run admin:create` | Crée en ligne de commande le tout premier compte administrateur.          |
| `npm run db:generate`  | Génère une nouvelle migration SQL Drizzle à partir du schéma.             |
| `npm run db:migrate`   | Applique les migrations en attente sur la base de données cible.          |
| `npm run db:studio`    | Ouvre l'interface graphique Drizzle Studio pour inspecter la base.        |

---

## 🚀 Déploiement en Production (Vercel & Neon)

### 1. Base de données Neon (Frankfurt `eu-central-1`)

1. Créez un projet Neon dans la région `eu-central-1` (Frankfurt) afin d'assurer une latence minimale avec la région Vercel `fra1`.
2. Créez une branche Neon dédiée pour la production (ex: `main` ou `production`).
3. Récupérez les deux chaînes de connexion :
   - Chaîne avec pooler (pour `DATABASE_URL`).
   - Chaîne directe sans pooler (pour `DATABASE_URL_UNPOOLED`).

### 2. Déploiement Vercel

1. Liez le dépôt GitHub à votre projet Vercel. Le framework SvelteKit est détecté automatiquement.
2. Dans **Settings > Environment Variables**, ajoutez :
   - `DATABASE_URL` : Chaîne poolée Neon.
   - `DATABASE_URL_UNPOOLED` : Chaîne directe Neon.
   - `CRON_SECRET` : Généré avec `openssl rand -base64 32`.
3. Appliquez les migrations sur la base de production avant le premier démarrage :
   ```bash
   DATABASE_URL_UNPOOLED="votre_chaine_neon" npm run db:migrate
   ```
4. Déployez le projet. Vercel configure automatiquement les fonctions serverless Node 24.

### 3. Tâche planifiée quotidienne (Vercel Cron)

Le fichier `vercel.json` configure l'exécution quotidienne du cron :

```json
{
	"$schema": "https://openapi.vercel.sh/vercel.json",
	"crons": [{ "path": "/api/cron/daily", "schedule": "0 15 * * *" }]
}
```

- **Horaire :** `0 15 * * *` (15h00 UTC, soit **16h00 à Bafoussam / Douala**).
- **Sécurité :** L'endpoint `/api/cron/daily` vérifie la présence du header `Authorization: Bearer <CRON_SECRET>`.
- **Comportement :**
  - Ignore l'exécution les jours non ouvrés (selon la configuration de l'établissement).
  - Envoie un rappel aux membres actifs ayant des tâches en cours non pointées aujourd'hui.
  - Envoie une alerte de clôture au chef le vendredi (dernier jour ouvré).
  - Envoie une alerte de génération de rapport mensuel le dernier jour ouvré du mois.

---

## 🔒 Sécurité, Confidentialité & RGPD

1. **Aucune fuite de données d'un membre :** Les membres n'ont accès qu'à leurs propres tâches et à leurs propres rapports validés.
2. **Cloisonnement des rôles :** Seul le chef de département peut affecter des tâches, valider des rapports et générer des consolidations mensuelles. L'administrateur technique n'a accès qu'à la gestion des comptes, aux paramètres globaux et au journal d'audit.
3. **Mots de passe sécurisés :** Hachage Argon2id résistant aux attaques GPU/ASIC. Aucun mot de passe n'est stocké en clair.
4. **Sessions anti-bruteforce :** Verrouillage automatique de 15 minutes après 5 échecs consécutifs d'authentification (`EF-AUT-05`).
5. **Traçabilité totale :** Chaque création d'utilisateur, modification de droit, réinitialisation de mot de passe, publication ou réouverture motivée de rapport est consignée de manière immuable dans la table `audit_log`.

---

## 📄 Licence

Usage interne confidentiel — **Hôtel Zingana**, Bafoussam, Cameroun. Tous droits réservés.
