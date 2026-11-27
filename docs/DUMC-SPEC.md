# DUMC — Legacy Compatibility Note

The official system identity is now **DUFS — DRM Universal Folder System**.

The former DUMC name is retained only where required for backwards compatibility:
- Existing Cloudflare D1 table names and settings keys (`dumc_*`).
- Existing stable root folder ID `DUMC`.
- Original migration filenames.
- Legacy API aliases at `/api/dumc/*` and `/api/admin/dumc/*`.
- Existing DOM/CSS hook names and legacy test entry points.

The canonical specification is now [DUFS-SPEC.md](DUFS-SPEC.md). New features and code should use DUFS names and namespaces. Do not rename or recreate existing database tables or stable folder IDs as part of this compatibility transition.
