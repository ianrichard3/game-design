# Simplification plan: microStudio -> minimal, Claude-drivable game engine

This file tracks an in-progress effort to strip microStudio down to a small, local,
single-user game engine: write code and assets, see the game run. Simple enough that
Claude Code can drive it just by editing files in a linked folder (the git-folder-linking
feature already shipped: `server/filestorage/folderstorage.coffee`, `folderwatcher.coffee`,
`server/session/gitmanager.coffee`, the Git panel, and the "Local folder" project option),
while the app's only remaining job is to stay open and hot-reload the running game.

**Verified 2026-07-23:** `cd server && npm install && npm run compile` and every Pug
template compile cleanly. Fresh temporary local-server tests covered the single-user
handshake, project creation/normalization, play route, linked-folder export, Git init/status,
icon generation, and HTML export.

## Decisions already locked in (don't re-ask)

- Delete outright, don't feature-flag.
- Narrow to microScript v2 + M1 graphics only (drop v1, Python, JS, Lua; drop M2D/M3D/PIXI/
  BABYLON).
- Single local user only — no login/accounts/collaboration. Local mode is the only mode.
- Keep only basic HTML export (drop native app builds, Node-server export, and the
  "make public"/community half of Publish).
- Drop 3D model preview (the Assets panel's `.glb`/`.obj` preview, which independently
  depends on a vendored Babylon v4 regardless of graphics engine choice).
- Git history was already erased and restarted fresh (this repo has 2 commits total, no
  `origin` remote by default — see "Pushing" below for the new remote).
- Execute in phased checkpoints: each phase should compile and boot cleanly before the next
  begins.

## Status

### Step 0 — Fresh git history — ✅ DONE
- Erased old `.git` (was a fork of `github.com/pmgl/microstudio.git`, MIT licensed —
  `LICENSE.txt` kept as-is, that's the only obligation the license carries and it's
  independent of git history).
- Fixed a pre-existing, unrelated build blocker: `static/js/languages/microscript/v2/
  processor.coffee` used `[...arguments]`, unsupported by the installed CoffeeScript 1.12.7.
  Fixed to `Array.prototype.slice.call(arguments)`. This is what let `npm run compile` work
  at all — it also revealed ~83 `.js` files were stale relative to their `.coffee` source
  (built previously with a different toolchain); recompiling brought them back in sync
  (verified: output-style diff only, ES5 IIFE vs ES6 class, not a behavior change).

### Phase 1 — Remove community/social/multiplayer/build-farm layer — ✅ DONE

**Done:**
- **Forum**: `server/forum/` deleted. Removed from `content/content.coffee` (require +
  `@forum` instantiation + `.close()`), `session/session.coffee` (require + `@forum_session`
  instantiation), `webapp.coffee` (require + `@forum_app` instantiation). Deleted
  `server/api.coffee` entirely (its `/api/status` endpoint only ever reported
  forum/community/build-farm data — nothing left to report once those are gone). Removed the
  `/community/` and Discord menu links from `templates/home.pug`, and the now-dead
  `menu-community` DOM reference in `static/js/appui/appui.coffee`.
- **Sync tab**: fully removed (redundant with the Git panel now that project storage can be
  a real git-linked folder). Deleted `static/js/sync/`, `templates/sync.pug`,
  `static/css/sync.css`. Removed from: `appui.coffee` (`@sections` entry +
  `setSection`'s `"sync"` branch), `app.coffee` (`@sync` instantiation + `.projectOpened()`
  call), `concatenator.coffee` (2 bundle entries), `home.pug` (menu item + section include),
  `session/session.coffee` (`sync_project_files` handler + `syncProjectFiles` method),
  `session/projectmanager.coffee` (`syncFiles` method).
- **Multiplayer/networking relay**: `server/relay/` deleted entirely (external `relay.coffee`
  process had zero live references; in-process `RelayService`/`ServerInstance` was
  instantiated in every `Session`). Removed from `session/session.coffee`: `RelayService`
  require, `@relay_service` instantiation, all 4 relay WS handlers
  (`relay_server_available`/`get_relay_server`/`get_server_token`/`check_server_token`) and
  their handler bodies (`relayServerAvailable`, `getRelayServer`, `getServerToken`,
  `serverTokensCleanup`, `checkServerToken`, `serverTokenCheck` — confirmed nothing else
  called these). Removed the "Enable networking" checkbox from `templates/home.pug` (create-
  project dialog) and `templates/projectoptions.pug` (Settings), and its wiring in
  `appui.coffee` and `options.coffee` (`networkingChanged`). Removed the `ServerBar`/
  `ServerWatcher` classes from `static/js/editor/runwindow.coffee` (multiplayer status
  widget — was polling the now-deleted `mp_server_status`/`get_relay_server` messages) and
  the now-nonfunctional `#serverbar` button markup from `templates/code.pug`. Follow-up
  audit removed the remaining relay client/server runtime, `/server.js` and Node-server-export
  bundles, empty server-console split pane, the special floating-client window, and every
  `networking` field/WS mutation. Existing persisted projects are normalized to private,
  non-networked state on load. Also removed the dead `?server`/`?srv` query-param branches
  from `webapp.coffee`'s play route (they only ever existed to serve a headless "server box"
  for multiplayer hosting) and deleted the now-orphaned `serverBox` method +
  `templates/play/serverbox.pug`.
- **Native app build farm**: `server/build/` deleted entirely. Removed from `server.coffee`
  (`BuildManager` require + `@build_manager` instantiation), `session/session.coffee`
  (`build_project`/`get_build_status`/`start_builder` handlers + their 3 bodies), and
  `webapp.coffee` (`@server.build_manager.createLinks(@app)` call).
- **Publish trimmed to HTML-only (server side)**: removed `publishServer()` (Node-server
  export) and the `SERVER_EXPORT_README` constant from `server/app/exportfeatures.coffee`,
  and the `?server=1` branch in `addPublishHTML()` that dispatched to it. The HTML5 export
  path (`addProjectFilesExport`/`addPublishHTML`'s main branch) is untouched.

**Completed in this continuation:**
- **Publish client**: reduced the Publish tab to HTML5 export only; removed native-build,
  Node-server export, public-listing controls, `AppBuild`, and its bundle entry.
- **Community and tutorials**: deleted Explore, public-project ranking and WS handlers,
  public likes/cloning/moderation, tutorial code/routes/markup, and their CSS. The local
  user's own library picker remains available; community libraries and plug-ins do not.
- **Collaboration**: deleted invite/link persistence and UI, active-user state, invite WS
  handlers, and public plug-in tabs; owner-only permission checks remain unchanged.
- **Dead code**: deleted BanIP, DumbApp, and the unused Tag index (including generated JS).
  Removed `express-force-https` and `websocket` and refreshed the lockfile.
- **Audit follow-up**: deleted the orphaned forum frontend/PWA assets and handlers, stale
  community/tutorial achievements, a duplicate `change_password` registration, and outdated
  homepage claims. Public project sharing is now disabled at creation, has no WS mutation
  endpoint, and is durably reset for old projects when they load.
- **Verification**: `npm run compile` passes. A 15-second `npm start` boot completed cleanly
  with the current local default configuration (Phase 3 will make standalone the only mode).

**Checkpoint passed:** the app compiles and starts without the Explore, Sync, Tutorial, or
community/project-invite surfaces.

### Phase 2 — Narrow language and graphics surface — ✅ DONE

- **Language**: removed microScript v1, Python, JavaScript, and Lua sources/runners and their
  bundle entries. The editor is v2-only; the server creates and normalizes every project to
  `microscript_v2`, so stale metadata cannot request a deleted runtime. `ace-builds` remains
  for the v2 editing mode.
- **Graphics**: removed M2D, M3D, PIXI, Babylon, their vendored libraries, alternate-player
  concatenation, graphics-version UI, 3D asset preview, and model import support. Projects
  are normalized to M1 and both project dialogs expose only that choice. Existing `.glb` and
  `.obj` files are left untouched but have no specialized preview.
- **Dependencies**: removed `brython` and `fengari-web`, plus their static serving routes and
  Python-specific play/export templates.
- **Verification**: `npm run compile` and all Pug template compilation pass; a local boot
  reached `local server running on port 8090` without missing bundle inputs.

### Phase 3 — Collapse to a single local user, strip remaining platform plumbing — ✅ DONE

- **Accounts — ✅ DONE**: standalone-equivalent single-user mode is now enforced on every
  boot, regardless of `config.json`'s old hosted settings. The server creates `microstudio`
  for an empty data directory (or reuses the sole existing user), refuses a multi-user data
  directory instead of silently deleting data, and listens locally on port 8089 by default.
  The client always sends the internal `token` bootstrap handshake; the server attaches it to
  the local user and returns immediately, so it cannot subsequently emit an `invalid token`.
  Removed all account lifecycle handlers, password-recovery/validation routes, mail stubs,
  password hashing (`crypto-js`), account rate-limit buckets, login/create-account UI and
  related CSS, profile/account/progress client panels, and their bundle entries. The app now
  routes directly to projects. `User`/`Token` records are left readable for existing local
  data but no longer participate in authentication.
- **Gamify, comments, and rate limits — ✅ DONE**: deleted their server/client modules,
  handlers, constructor dependencies, and all obsolete guard clauses. The hosted-user cleaner
  and process-statistics loop are also gone.
- **English-only UI — ✅ DONE**: removed the language switcher and seven language JSON files;
  both translator classes are English identity functions.
- **Local-only server — ✅ DONE**: deleted TLS/proxy/plugin loading, production configuration,
  alternate domains, external QR sharing, console routes, profile-image route, and related
  dependencies. The HTTP/WebSocket listener is fixed to `127.0.0.1` (default port 8089).
- **Dependencies — ✅ DONE**: removed account/hosting/runtime packages and the duplicate
  Source Sans package. The remaining direct dependencies were upgraded through `npm audit`,
  including Jimp 1.6 and DOMPurify 3.4; the icon/export call sites were migrated and tested.

**Checkpoint passed:** a local boot has no login step; editing, running, folder linking, and
Git init/status all work in the one local workspace.

### Phase 4 — Simplify the UI shell and docs — ✅ DONE

- **UI shell — ✅ DONE**: the marketing home page, publish/tab-manager shells, QR sharing,
  stale console surfaces, and dead selectors are gone. The visible IDE tabs are Code, Sprites,
  Maps, Assets, Sounds, Music, Doc, Git, and Settings; HTML export is in Settings.
- **Docs and styling — ✅ DONE**: removed unreachable help entries and the legacy home,
  publish, console, server, account, and public-profile styles.
- **Documentation and dependencies — ✅ DONE**: rewrote `README.md` for the local workflow,
  regenerated the lockfile with `npm install`, and verified `npm audit --omit=dev` reports
  zero vulnerabilities.

**Checkpoint passed:** fresh dependency install, compile, template compilation, and temporary
server tests pass. The tested flow is create → run → link local folder → Git init/status →
HTML export.

## Explicitly out of scope / preserved as-is

The git-folder linking feature and everything under `server/filestorage/`,
`server/session/gitmanager.coffee`, the Git panel, `server/db/` (flat-file DB), the
CoffeeScript build toolchain itself (not migrating to hand-written JS — this becomes newly
*feasible* at the reduced size, but it's a separate decision), and all the core creative
editors (code/sprite/map/sound/music/assets/doc) and the microScript v2 runtime are untouched
by this plan except where a phase above explicitly edits them.

## Key findings worth remembering (don't re-derive)

- The bootstrap handshake is intentionally authentication-free because the listener is bound
  to `127.0.0.1` and every connection maps to the sole local user.
- The in-IDE Run/preview window is **not self-contained** — it iframes into the same public
  "play" page route (`/user/project/`) and runtime bundle (`/play.js`) that would normally
  serve a published game. That route/runtime must stay. `concatenator.coffee` is dual-
  purpose (live-preview bundling + export bundling) and stays as a file.
- `canRead`/`canWrite`/`canReadProject` degrade safely to "owner-only" once collaboration is
  empty — don't touch them, just remove what populates `project.users`.
- `Translator.get()` is called at ~175 client call sites — plumbing, not a feature. Collapse
  to English-only identity function; don't delete the class.
- No v1→v2 microScript migration tool exists — the new default is just `microscript_v2`
  everywhere, no conversion logic needed.
