# Team Project Starter

A small, generic starter for a school team project. It includes an Express API written in TypeScript, PostgreSQL, Docker Compose, ordered migrations, and a sample CRUD resource. The starter has no company data, company branding, external API credentials, or preselected business domain.

## Requirements

- Node.js 24 or newer
- Docker Desktop
- Git

## Run locally (PowerShell)

```powershell
Copy-Item .env.example .env
notepad .env
```

Change `POSTGRES_PASSWORD` in `.env` to a local password, then run:

```powershell
docker compose up -d
npm install
npm run migrate
npm run dev
```

Open `http://127.0.0.1:3000/health` to check the database connection. The sample API is under `/api/records`:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/records
Invoke-RestMethod http://127.0.0.1:3000/api/records -Method Post -ContentType 'application/json' -Body '{"title":"First team idea","description":"Replace with your own project data."}'
```

## Make it your group's project

1. Agree on a problem your group wants to solve. You may keep, replace, or remove the sample `records` resource.
2. Sketch the screens and user flow before choosing extra packages.
3. Rename the app and database, then choose your own colors, layout, entities, roles, and features.
4. Keep business logic in focused modules, validate input at API boundaries, and add a migration when the schema changes.
5. Use synthetic data. Never put real customer/student information, API tokens, passwords, or private company material in the repository.
6. Each teammate works on a branch; review changes before merging to the shared branch.

## Useful commands

```powershell
npm run typecheck
npm run build
npm start
docker compose down
```

`docker compose down` stops the local database but keeps its volume. To remove the local database volume, use `docker compose down -v`; that permanently deletes this starter's local database data.
