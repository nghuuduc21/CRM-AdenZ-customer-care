# Team workflow

## Let people bring their own style

- The shared repository is a technical starting point, not a locked product design.
- Let each teammate propose a name, visual direction, and feature idea before the group selects a direction.
- Agree on API contracts and database changes together; let implementation details and interface styling vary by feature owner.
- Keep shared rules short: input validation, migrations, naming, and how changes are reviewed.

## Divide work

- Product/design: problem statement, user flow, interface direction.
- Data/backend: schema, migrations, API contract.
- Frontend: screens, responsive layout, accessibility.
- Integration/review: connect features, check edge cases, keep setup instructions current.

For a small team, people can rotate roles. Avoid assigning only one person all database, integration, or review work.

## Git habits

- Use one branch per feature and small commits with descriptive messages.
- Pull the shared branch before starting work.
- Open a pull request or ask a teammate to review before merging.
- Do not commit `.env`, database dumps, uploaded files, or private datasets.
- If a secret is committed, revoke or rotate it; deleting it in a later commit does not remove it from Git history.

## Classroom data

Use fabricated names and addresses such as `student01@example.com`. Do not copy company customer data, screenshots, internal documents, API payloads, tokens, or source histories into this repository. Check school and company rules before publishing the repository publicly.
