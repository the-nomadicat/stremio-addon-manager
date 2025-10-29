# Stremio Addon Manager
Manage your Stremio addons and catalogs with ease.

**WARNING: Use this at your own risk. This is not an official Stremio product and may break your Stremio installation. No support or warranty is given.**

This tool talks directly to Stremio's internal API. Misusing it can break core Stremio functionality (for example: Cinemeta catalogs and other required metadata sources). You can back up and restore your configuration, but there is no guaranteed "factory reset." Use with caution.

> This project was originally created by [`pancake3000`](https://github.com/pancake3000/stremio-addon-manager), extended by [`redd-ravenn`](https://github.com/redd-ravenn/stremio-addon-manager), and further expanded here. See **Credits / Lineage** for details.

## Features
### Multi-Account Saved Logins (Optional)
You can enable "saved logins on this device" to quickly switch between multiple Stremio accounts:
- Store multiple accounts (email/password/AuthKey) locally in your browser
- Pick an account from a dropdown instead of retyping credentials
- Rename saved accounts (e.g. `Mum`, `Guest`, `Test`)
- Delete individual saved accounts
- Turn the feature off to wipe all saved accounts at once (with confirmation)

Security note: Saved logins are stored locally in this browser only. They are not uploaded anywhere by this project. Anyone with access to that browser profile could reuse those credentials in Stremio. Do **not** enable this on a shared/public machine.

### Addon & Catalog Management
- Re-order your addons (including Cinemeta)
- Re-order catalogs, including Cinemeta-provided catalogs (e.g. "Popular", "Featured")
- Hide or show catalogs on Stremio's Home screen without uninstalling anything
- Remove non-protected addons

### Per-Addon Catalog Editing
For each addon, you can open an "Edit manifest" panel and:
- Rename that addon's catalogs
- Delete catalogs you don't want
- Drag & drop to reorder that addon's catalogs
- Choose whether each catalog appears on the Stremio Home screen

This gives you fine-grained control over what each addon exposes, and how it surfaces in Stremio.

### Backup / Restore
- Export your full addon + catalog configuration to a file ("Backup")
- Import that file later ("Restore") to roll back to a known good state or apply the same layout to another account/device

Note: You are responsible for taking the backup. Restoring a bad backup can still make things worse. There's no built-in "safe defaults" button.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur to avoid conflicts)

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
This will produce a static production build in the `dist/` folder. You can serve the `dist/` directory with any static web server, or use Docker (below).

## Docker
Run the following commands to build and run the app in a Docker container:

```bash
$ docker build -t stremio-addon-manager .
$ docker run -p 8080:80 stremio-addon-manager
```

The app will be accessible at `http://localhost:8080`.

## Security Model (for contributors and reviewers)
- Your Stremio email/password or AuthKey is used to authenticate directly with Stremio's API.
- By default, credentials live only in memory and are gone when you refresh.
- If you explicitly enable "saved logins on this device," credentials (including AuthKey) are stored locally in that browser so you can switch accounts later.
- Nothing is uploaded anywhere by this project.
- Anyone with access to the same browser profile could reuse those credentials. The UI warns about this.

Contributors: please do not silently change this behavior.

## Step-by-Step Workflow (how the UI is meant to be used)
**STEP 0: Authenticate**
Log in using Stremio email + password (Facebook login is not supported here) to generate a new AuthKey, or paste an existing AuthKey from https://web.stremio.com/. If saved logins are enabled, you can just pick a stored account instead of typing credentials again.

**STEP 1: Load Addons / Backup**
Click "Load Addons" to pull in the current addons and catalogs for that account. Click "Backup" to download a JSON snapshot of that configuration. Use "Restore…" later to re-import that snapshot or to clone the same setup onto another account.

**STEP 2: Edit / Re-order Addons & Catalogs**
- Drag addons to change priority/order
- Reorder catalogs
- Hide/show catalogs on the Home screen (including Cinemeta's catalogs)
- Open "Edit manifest" for an addon to rename its catalogs, delete ones you don't want, and reorder them — no manual JSON editing required

**STEP 3: Sync Addons**
Click "Sync to Stremio" to apply the new order, names, visibility and layout to the currently signed-in account. If you regret it, restore the backup from Step 1.

## Credits / Lineage
This project is part of an ongoing community effort:
- **Original concept and implementation:** [pancake3000/stremio-addon-manager](https://github.com/pancake3000/stremio-addon-manager)
- **Major improvements and the first "Edit manifest" work (renaming/removing catalogs inside an addon):** [redd-ravenn/stremio-addon-manager](https://github.com/redd-ravenn/stremio-addon-manager)
- **This fork (the-nomadicat/stremio-addon-manager) adds:**
  - Catalog reordering within an addon (drag & drop)
  - Toggle whether each catalog appears on the Stremio Home screen (including Cinemeta catalogs, without uninstalling Cinemeta)
  - Global catalog reordering and hide/show without removing addons
  - Multi-account saved logins (with rename / delete / wipe-all UI)
  - Backup / restore workflow
  - Guided step-based UI ("Authenticate → Load/Backup → Edit/Reorder → Sync")
  - Stronger destructive-action confirmations and clearer warnings

Thanks also to `Sleeyax` and `<Code/>` for early conversations and code snippets that helped shape this tool.

## Legal / Support
- This tool is unofficial and not affiliated with Stremio.
- No warranty or support is provided.
- Use responsibly, especially if you're modifying someone else's Stremio profile.