---
name: Replit env domain drift
description: The .replit userenv.shared domain may not match the live REPLIT_DEV_DOMAIN, leading to a broken API URL.
---

# Replit env domain drift

When setting up a freshly imported project, the `.replit` file may contain `userenv.shared` values from the original environment. The actual `REPLIT_DEV_DOMAIN` for the current Repl can be different.

**Rule:** Update `NEXT_PUBLIC_API_URL`, `BACKEND_URL`, and `FRONTEND_URL` using the live `REPLIT_DEV_DOMAIN`, not the stale values from `.replit`.

**Why:** The imported project had `NEXT_PUBLIC_API_URL` and `BACKEND_URL` pointing to `:4000` on the old domain, while the live backend is exposed on port 80 (root domain). The frontend is exposed on port 3000. This mismatch caused all API calls from the frontend to fail with a wrong URL.

**How to apply:** Check `REPLIT_DEV_DOMAIN` (e.g., `echo $REPLIT_DEV_DOMAIN`), then set:
- `BACKEND_URL` = `https://<REPLIT_DEV_DOMAIN>`
- `NEXT_PUBLIC_API_URL` = `https://<REPLIT_DEV_DOMAIN>`
- `FRONTEND_URL` = `https://<REPLIT_DEV_DOMAIN>:3000`

Use `setEnvVars` to update the environment; use `verifyAndReplaceDotReplit` if you need to update `.replit`.
