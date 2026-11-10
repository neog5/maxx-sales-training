# Documentation

## For people using the portal

- [User guide](user-guide/README.md): [learners](user-guide/learners.md), [managers](user-guide/managers.md) and [admins](user-guide/admins.md)

## For developers

| Doc | Covers |
|---|---|
| [Local setup](developer/setup.md) | Install, build the database, environment variables, first super admin, commands |
| [Architecture](developer/architecture.md) | Stack, request flow, roles, folder layout, `lib/` modules, UI conventions |
| [Data model](developer/data-model.md) | Tables, row-level security, database functions, triggers, storage |
| [How the features work](developer/features.md) | Reading, assessments, attempt limit, certificates, compliance, admin tools, AI suggestions |
| [Security](developer/security.md) | What's protected, and the known gaps before results can be trusted |
| [Deployment](developer/deployment.md) | Cloudflare Workers, environments, variables, limits, production launch checklist |
| [Operations](developer/operations.md) | Database changes, email alerts, certificate template, common admin requests |
| [Testing](TESTING.md) | Automated tests and the manual test plan ([latest results](TEST-RESULTS.md)) |
| [WordPress import](wordpress-import.md) | Moving courses over from the old LearnDash portal |

Keep these up to date in the same change as the code. The data model and setup lists change with every migration.
