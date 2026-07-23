# Simplification plan: microStudio -> minimal, Claude-drivable game engine

This file tracks an in-progress effort to strip microStudio down to a small, local,
single-user game engine: write code and assets, see the game run. Simple enough that
Claude Code can drive it just by editing files in a linked folder (the git-folder-linking
feature already shipped: `server/filestorage/folderstorage.coffee`, `folderwatcher.coffee`,
`server/session/gitmanager.coffee`, the Git panel, and the "Local folder" project option),
while the app's only remaining job is to stay open and hot-reload the running game.

**⚠️ Not verified yet.** The last handful of edits (Phase 1, native app build farm / Publish
trim section) were made but never compiled or boot-tested — work was paused mid-session.
**Before continuing or trusting this state, run:**

```
cd server
npm run compile   # must exit clean, zero errors
npm start         # boots on a random port in standalone mode; open it, confirm no crash
```

If compile fails, the error will point at the file — most likely something in
`server/webapp.coffee`, `server/app/exportfeatures.coffee`, or `server/session/session.coffee`
since those had the most recent edits.

## Decisions already locked in (don't re-ask)

- Delete outright, don't feature-flag.
- Narrow to microScript v2 + M1 graphics only (drop v1, Python, JS, Lua; drop M2D/M3D/PIXI/
  BABYLON).
- Single local user only — no login/accounts/collaboration. Standalone mode becomes the only
  mode.
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

### Phase 1 — Remove community/social/multiplayer/build-farm layer — 🚧 IN PROGRESS

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
  the now-nonfunctional `#serverbar` button markup from `templates/code.pug` — **left the
  `#runtime-server-view`/`#runtime-server-splitbar` container elements in place**, they're
  structurally required as positional `childNodes` by `SplitBar`'s constructor
  (`static/js/util/splitbar.coffee`), just permanently empty/collapsed now. Also removed the
  dead `?server`/`?srv` query-param branches from `webapp.coffee`'s play route (they only
  ever existed to serve a headless "server box" for multiplayer hosting) and deleted the now-
  orphaned `serverBox` method + `templates/play/serverbox.pug`. The `networking` field on
  `Project`/`project.coffee` was deliberately left in place but inert — harmless boolean,
  not stripped.
- **Native app build farm**: `server/build/` deleted entirely. Removed from `server.coffee`
  (`BuildManager` require + `@build_manager` instantiation), `session/session.coffee`
  (`build_project`/`get_build_status`/`start_builder` handlers + their 3 bodies), and
  `webapp.coffee` (`@server.build_manager.createLinks(@app)` call).
- **Publish trimmed to HTML-only (server side)**: removed `publishServer()` (Node-server
  export) and the `SERVER_EXPORT_README` constant from `server/app/exportfeatures.coffee`,
  and the `?server=1` branch in `addPublishHTML()` that dispatched to it. The HTML5 export
  path (`addProjectFilesExport`/`addPublishHTML`'s main branch) is untouched.

**Not started yet (still to do in Phase 1):**
- **Publish trimmed to HTML-only (client side)** — `templates/publish.pug` still has the
  native-build buttons, the Node-server export button, and the "make public"/Explore listing
  box (`#publish-box-online`). `static/js/publish/appbuild.coffee` (native build UI class)
  still exists and is still in `concatenator.coffee`'s bundle list — needs deleting.
  `static/js/publish/publish.coffee` needs trimming to just the HTML5 export button/flow.
- **Community / explore / public-project browsing** — NOT STARTED. Still need to delete
  `static/js/explore/` (`Explore`, `ProjectDetails` — this file also contains the moderation
  UI, which goes with it), the Explore tab/menu wiring in `appui.coffee`/`home.pug`, and
  server-side the public-projects aggregation in `content/content.coffee`
  (`hot_projects`/`top_projects`/`new_projects`/tags/`sortPublicProjects` interval loop) plus
  the `get_public_*`/`toggle_like`/`clone_public_project`/`set_project_approved`/
  `set_user_approved` WS handlers in `session.coffee`. Keep `project.public`/`unlisted`
  fields themselves (harmless booleans) and keep the generic `cloneProject` (non-public
  duplicate) — only the public-facing aggregation goes. Note: `static/css/explore.css` also
  needs deleting (Phase 4 already planned to sweep CSS, but fine to do now too).
- **Tutorials** — NOT STARTED. Delete `static/js/tutorial/`, `tutorialwindow.coffee`,
  `tutorials.coffee`, `tutorialspage.coffee`, `highlighter.coffee`; remove their
  `@menuoptions`/routing entries in `appui.coffee`/`appstate.coffee`; remove the floating
  tutorial window markup in `home.pug`; no-op the `checkTutorial()` banner call in
  `doceditor.coffee` rather than chasing further. `app.coffee` currently has
  `@tutorial = new TutorialWindow @`, `@tutorials = new Tutorials @`, and an
  `if not @tutorial.shown` auto-start block in `openProject()` — all need removing.
- **Project collaboration/invite UI** — NOT STARTED. Remove the invite/accept/remove-user WS
  handlers in `session.coffee`, `ProjectLink`/`inviteUser`/`removeUser`/`listUsers` in
  `content/project.coffee`, and the invite-list UI in `options.coffee`/`projectoptions.pug`.
  **Do not touch** `canRead`/`canWrite`/`canReadProject` in `session/projectmanager.coffee` —
  they degrade correctly to "owner-only" once `project.users` is always empty, no changes
  needed there. The "project-tabs" plugin-sharing half of `tabmanager.coffee`/
  `pluginview.coffee` (embedding *other* community projects as tabs) goes with this; the
  harmless "show/hide sidebar sections" checkboxes in the same file can stay or go with
  Phase 4.
- **Dead code, free wins** — NOT STARTED. `server/banip.coffee` and `server/dumbapp.coffee`
  are already fully dead (zero live references, confirmed by research, not touched by
  anything above) — just delete both files. Also remove the `express-force-https` and
  `websocket` npm dependencies from `server/package.json` (confirmed zero `require` call
  sites — the real WS implementation used everywhere is the separate `ws` package).
- Also: the 3 forum-specific rate-limiter buckets (`create_forum_post`/`create_forum_reply`/
  `search_forum`) in `server/ratelimiter.coffee` were deliberately left alone — harmless now-
  unused buckets, the whole file gets deleted in Phase 3 anyway, no need to touch twice.

**Checkpoint (once the rest of Phase 1 is done):** `npm run compile` clean, server boots in
standalone mode, a project opens and its Code/Sprites/Maps/Sounds/Music/Assets/Doc/Git/
Settings tabs all still work; the sidebar no longer shows Explore/Sync/Tutorials/Community.

### Phase 2 — Narrow language and graphics surface — NOT STARTED

- **Language**: delete `static/js/languages/microscript/{parser,program,token,tokenizer,
  runner_v1_i,runner_v1_t,jstranspiler}.coffee` (v1, both variants) and the `python/`,
  `javascript/`, `lua/` directories under `static/js/languages/`. Keep
  `microscript/random.coffee` (shared PRNG, used by v2 too) and edit — not delete —
  `microscript/microscript.coffee` (drop its v1 Ace-mode half, keep the v2 half). In
  `concatenator.coffee`, trim `@language_engines` to just `microscript_v2` and drop the
  removed languages' script bundling. Change the legacy-project language default from
  `"microscript_v1_i"` to `"microscript_v2"` in both `content/project.coffee` and
  `static/js/options/options.coffee` (still has this literal default string — grep for it),
  and drop the dead `when "python"/"javascript"/"lua"` branches in
  `static/js/editor/editor.coffee`. `ace-builds` stays (still needed for the v2 editor mode).
- **Graphics**: delete `static/js/runtime/{m2d,m3d,pixi,babylon}/` (8 files) and their
  vendored libraries under `static/lib/{pixijs,babylonjs}/`. In `concatenator.coffee`, trim
  `@alt_players` to empty (M1 is the implicit fallback, not a named entry). Remove the
  hardcoded `M2D`/`M3D`/`PIXI`/`BABYLON` `<option>` tags from `templates/home.pug` and
  `templates/projectoptions.pug` (unlike the language select, these are literal, not data-
  driven). In `static/js/assets/modelviewer.coffee`, remove the dynamic Babylon-v4 injection
  and 3D preview — `.glb`/`.obj` files fall back to a generic file icon. Leave the now-dead
  `if window.graphics == "M3D"/...` branch in `runtime.coffee` and the `PIXI`/`BABYLON`
  guards in `timemachine.coffee`/`assetmanager.coffee` as harmless no-ops.
- Drop the `brython`/`fengari-web` npm dependencies (Python/Lua browser interpreters).

**Checkpoint**: `npm run compile` clean, a project's language/graphics options in Settings
show only microScript v2 / M1, a game still runs and hot-reloads correctly in the Run window.

### Phase 3 — Collapse to a single local user, strip remaining platform plumbing — NOT STARTED

- **Accounts**: make standalone-equivalent single-user mode the *only* mode (fold
  `config.standalone`'s behavior into the normal boot path in `server.coffee` rather than
  branching on it). Remove the account-lifecycle WS handlers that no login flow ever reaches
  (`create_account`, `create_guest`, `login`, `send_password_recovery`, `delete_guest`,
  `delete_account`, `change_password` — registered twice today, a latent dead registration
  worth cleaning up regardless —, `send_validation_mail`, `change_email`, `change_nick`,
  `change_newsletter`, `set_user_profile`) from `session.coffee`. Keep the `token` handshake
  message (client bootstrap still needs it) and keep `User`/`Token` classes structurally.
  Client: delete the login/guest/create-account overlay and its wiring in `appui.coffee`
  (`createLoginFunctions`, `accountRequired`, `userConnected`/`userDisconnected`'s login-
  specific branches) and `app.coffee` (`createGuest`/`createAccount`/`login`/
  `sendPasswordRecovery`/`disconnect`), plus `static/js/user/usersettings.coffee` and
  `translationapp.coffee`. `appstate.coffee`'s router should land directly in the (now
  permanently open, single) project instead of branching on `@app.user?`.
- **Gamify/progress**: remove `server/gamify/` and the `User.progress` constructor
  dependency in `content/user.coffee`, plus the `recordTime`/`incrementLimitedStat`/
  achievement-unlock calls in `session.coffee`'s surviving handlers. Client:
  `static/js/user/progress.coffee` and the stats/achievements tab in `templates/user.pug`.
- **Comments**: remove `content/comments.coffee`, the `Project.comments` constructor
  dependency, and the `get_project_comments`/`add_project_comment`/etc. handlers in
  `session.coffee`.
- **Rate limiting & ban-ip**: remove `server/ratelimiter.coffee` and its ~32 call sites
  (mechanical guard-clause removal across `session.coffee`, `webapp.coffee`,
  `projectmanager.coffee`, `server.coffee`). One call site sits in the core file-write path
  (`projectmanager.coffee`'s `create_file_user` check) — remove the guard, not the
  surrounding function. `server/banip.coffee` should already be gone (Phase 1).
- **i18n switcher**: remove the 8 language JSON files down to `en` only, the language-menu
  UI in `home.pug`/`appui.coffee`, and the `get_language`/`get_translation_list`/
  `set_translation`/`add_translation` WS handlers. Collapse `Translator.get()` to return its
  input string unchanged (identity function) rather than deleting the class.
- **Production/TLS hosting**: remove the `PROD`/`PROXY`/greenlock-express branches in
  `server.coffee`'s `create()`, `config_prod.json`, and the `greenlock-express`/
  `greenlock-store-fs`/`le-acme-core` npm dependencies — only the standalone boot path
  remains.
- **Plugin system**: remove `loadPlugins`/`loadPlugin` in `server.coffee` and the 4 call
  sites that consult `@plugins`.
- Drop the `crypto-js` (password hashing) and `sanitize-html` (forum/bio-only) npm
  dependencies. Verify `fontsource-source-sans-pro` is truly an unused duplicate of
  `@fontsource/source-sans-pro` before removing it.

**Checkpoint**: `npm run compile` clean, server boots straight into the one local project
workspace with no login step at all, editing/running/git-panel all still work.

### Phase 4 — Simplify the UI shell and docs — NOT STARTED

- Trim `templates/home.pug` down to the actual IDE surface: delete the `home-section`
  marketing block (~140 lines, purely inline landing-page content), the login/create-project
  overlay, and the explore/tutorials/usersettings `<div>` sections (already unreachable
  after Phase 3, this just deletes dead markup). Keep the `run-window` floating panel and
  the generic `confirm-message`/`notification-container` overlays.
- Trim `AppUI.@sections`/`@menuoptions` in `appui.coffee` down to the surviving tabs (Code,
  Sprites, Maps, Sounds, Music, Assets, Doc, Git, Settings) and `App`'s instantiation list in
  `app.coffee` to match.
- Drop `static/css/home.css`, `explore.css`, `tutorial.css`, `user.css`, `userpage.css`, and
  any leftover forum CSS.
- Rewrite `README.md` to describe the simplified local tool (drop references to the cloud
  service, community, classroom self-hosting) and confirm `npm start`/`npm run dev` boot
  instructions are still accurate.
- Re-audit `server/package.json` once the above lands and run `npm install` to regenerate
  `package-lock.json` cleanly.

**Checkpoint**: fresh `npm install && npm run dev` boots the app straight into a working
local project with only Code/Sprites/Maps/Sounds/Music/Assets/Doc/Git/Settings visible; the
full create → edit (in-browser and via a linked folder) → run → git commit loop passes
end-to-end (there's a WS-driven integration test pattern used earlier in this project's
history for exactly this — create project, write files, link to a folder, external-edit
hot-reload, git init/commit/status — worth rebuilding as a quick script rather than only
testing by hand).

## Explicitly out of scope / preserved as-is

The git-folder linking feature and everything under `server/filestorage/`,
`server/session/gitmanager.coffee`, the Git panel, `server/db/` (flat-file DB), the
CoffeeScript build toolchain itself (not migrating to hand-written JS — this becomes newly
*feasible* at the reduced size, but it's a separate decision), and all the core creative
editors (code/sprite/map/sound/music/assets/doc) and the microScript v2 runtime are untouched
by this plan except where a phase above explicitly edits them.

## Key findings worth remembering (don't re-derive)

- `config.standalone` single-user mode already exists and is a proven, live code path —
  lean on it rather than building new auth-bypass logic.
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
