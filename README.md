# Customer Care Team Demo

A PostgreSQL-backed customer-care learning project. Its navigation, customer profiles, campaign flow, care journeys, dashboard, scoring screens, and settings follow the Care application layout. The repository contains a synthetic demo seeder and has no company database, credentials, API tokens, internal planning documents, or live email delivery.

## Requirements

- Node.js 24 or newer
- Docker Desktop
- Git

## Run locally (PowerShell)

```powershell
Copy-Item .env.example .env
notepad .env
```

Set a private local value for `POSTGRES_PASSWORD` and save the file. Keep `.env` local. Then run:

```powershell
docker compose up -d
npm install
npm run migrate
npm run import:customers
npm run dev
```

Open `http://127.0.0.1:3000`. On first use, create the local administrator account from the login page. Check the database at `http://127.0.0.1:3000/health`.

The application imports customer, product, order, lead, activity and passenger data directly from `data/source/customers.xlsx`. Re-running `npm run import:customers` upserts the workbook rows and recalculates customer scores. Campaign and journey actions remain disabled until the operational email settings are configured.

## Project structure

- `src/modules/` contains the auth, customer, campaign, journey, dashboard, scoring, settings, catalog, and care-task modules.
- `src/db/` contains PostgreSQL connection and migration runner.
- `migrations/` contains ordered SQL migrations.
- `public/` contains the web interface.
- `src/scripts/import-customers.ts` imports the workbook into PostgreSQL.

## Team workflow

Each teammate should use a feature branch and a separate local `.env`/database. Use fabricated information only. Before committing, inspect `git status --short` and make sure `.env`, workbooks, database dumps, screenshots with customer data, and other private company material are not staged. See [team-workflow.md](docs/team-workflow.md).

## Useful commands

```powershell
npm run typecheck
npm run build
npm start
docker compose down
```

`docker compose down` stops PostgreSQL and keeps its data volume. `docker compose down -v` permanently deletes this local demo database.
