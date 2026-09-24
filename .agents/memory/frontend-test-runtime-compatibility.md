---
name: Frontend test runtime compatibility
description: Node and frontend test dependency compatibility in this workspace
---

The workspace runtime is Node 20, while the declared jsdom 30 and backend toolchain versions require newer Node releases. DOM tests need a Node-20-compatible local dependency installation when the workspace runtime cannot be upgraded.

**Why:** Installing the declared frontend dependencies without accounting for the runtime can make both Vitest DOM workers and the Next dev server unavailable.

**How to apply:** Check the active Node version before repairing frontend dependencies; keep tracked manifests unchanged when using a local compatibility recovery, and verify the app workflow after reinstalling.