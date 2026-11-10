# Maxx Orthopedics Rep Training Portal

Online training for Maxx Orthopedics sales reps and distributors. Learners read course PDFs with reading questions along the way, take randomized assessments, and earn certificates. Admins build courses (with AI-suggested questions), assign them to training groups or people, and track who is compliant.

Built with Next.js 16 (App Router) and Supabase, hosted on Cloudflare Workers.

| Environment | URL | Branch |
|---|---|---|
| dev | https://training-dev.maxxorthoportal.com | `dev` |
| production | https://training.maxxorthoportal.com (not launched yet) | `main` |

## Quick start

```bash
npm install
cp .env.local.example .env.local   # add your Supabase URL and anon key
npm run dev
```

You'll need a Supabase project with the schema built first. See [Local setup](docs/developer/setup.md).

## Documentation

All docs are in [docs/](docs/README.md):

- **Using the portal:** [learners](docs/user-guide/learners.md), [managers](docs/user-guide/managers.md), [admins](docs/user-guide/admins.md)
- **Developing it:**
  - [setup](docs/developer/setup.md)
  - [architecture](docs/developer/architecture.md)
  - [data model](docs/developer/data-model.md)
  - [features](docs/developer/features.md)
  - [security](docs/developer/security.md)
  - [deployment](docs/developer/deployment.md)
  - [operations](docs/developer/operations.md)
  - [testing](docs/TESTING.md)

## Commands

```bash
npm run dev         # development server
npm run check       # lint, unit tests and production build
npm run test:db     # database permission tests (needs SUPABASE_DB_URL)
npm run deploy:dev  # deploy the dev Worker
```

The full list is in [setup](docs/developer/setup.md#commands).

## Status

Not launched yet. The database checks reading and grades assessments (migration 011), so learners can't change their own results. The remaining open points are in [Security](docs/developer/security.md); the steps to go live are in the [launch checklist](docs/developer/deployment.md#production-launch-checklist).

No licence has been chosen. A public repository without a `LICENSE` file doesn't give anyone permission to copy or modify the code.
