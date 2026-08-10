---
name: Development database migration ledger
description: The development database can match an old Prisma baseline while lacking the _prisma_migrations ledger, making normal forward deployment unsafe.
---

The development database may contain a legacy catalog schema without a `_prisma_migrations` table. Treat the live schema as an unrecorded baseline rather than assuming Prisma can determine the latest applied migration.

**Why:** A read-only audit found the initial catalog tables and data, but no migration ledger, while the repository schema expects later divisions, planner, auth, session, and catalog fields.

**How to apply:** Before any recovery, compare the live schema to the migration SQL and choose an explicitly controlled baseline/rebuild procedure. Do not run `prisma migrate deploy` blindly.