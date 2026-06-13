# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome Manifest V3 extension (`Flow MetaData Downloader/`) that downloads, analyzes, and lints Salesforce Flow metadata via the Salesforce Tooling API, driven entirely from the toolbar popup. The published Chrome Web Store version is the source of truth — keep `Flow MetaData Downloader/manifest.json`'s `version` in sync with what's published (currently `3.0.0.2`, ID `bdonpnepbmgmhgciooglhfdnoepfnpkp`).

## Build / run / test

There is **no build step, package manager, bundler, linter, or test suite** — it is vanilla ES modules loaded directly by Chrome. Do not add `npm install`/build commands or look for `package.json`; none exist.

To run and iterate:
1. `chrome://extensions/` → enable Developer mode → "Load unpacked" → select the `Flow MetaData Downloader/` folder.
2. After editing, click the reload icon on the extension card in `chrome://extensions/`.
3. Debug the popup via right-click the popup → Inspect; debug the service worker via the "service worker" link on the extension card.
4. The extension only functions on a logged-in Salesforce tab (`*.salesforce.com` / `*.lightning.force.com`) — it reads the live `sid` session cookie, so there is no offline/mock mode.

## Architecture

Three roles communicate by `chrome.runtime` messaging; the popup is the controller and the only place with a DOM.

- **`background.js`** (service worker, `type: module`) — the *only* component allowed to read cookies. It answers a single `getSession` message by fetching the Salesforce `sid` cookie and returning `{ key, hostName }`. All auth flows through here because content/popup contexts can't read httpOnly session cookies.

- **`sf-connection.js`** (`SFConnection`, default export) — the transport layer. `init()` reads the active tab's URL, normalizes `*.lightning.force.com` → `*.my.salesforce.com`, requests the session from the background worker, and stores the `sid` in a private field. Exposes `get/post/patch` against the Tooling API and pins `apiVersion = "v58.0"`. **All Salesforce HTTP goes through this class** — do not `fetch` Salesforce directly elsewhere.

- **`flow-service.js`** (`FlowService`, default export) — all Flow domain logic, constructed with an `SFConnection`. Two responsibilities:
  - *Fetch/resolve/deploy*: resolves a `300`-prefixed Flow **Definition** ID to its active `301` **Version** ID, fetches metadata, enumerates versions/definitions, and `deployFlow()` PATCHes updated metadata back.
  - *Static analysis* (pure functions over the flow JSON): `findDMLElementsInsideLoops`, `findSOQLInsideLoops` (both delegate to `findElementsInsideLoops`, which walks loop connectors), `findHardcodedIds` (regex for 15/18-char SF IDs), and `findUnusedItems` (resource names absent from the stringified rest of the flow).

- **`popup.js` / `popup.html` / `styles.css`** — the controller and UI. On open it builds the `SFConnection` + `FlowService`, then branches: if the current tab URL has a `flowId`/`flowDefId` it loads that flow directly; otherwise it shows a **debounced search** over all flow definitions → version list → opens the chosen version in Flow Builder. Wires the action buttons: Download JSON, Copy JSON, Copy-to-Describe (builds an LLM analysis prompt), Run Analysis (renders findings into a severity-colored table), and Fix Nomenclature.

- **`utils.js`** — `extractNonNullProperties`, a recursive object/array pruner.

- **`analytics.js`** (`track(eventName)`, named export) — anonymous UI usage telemetry via the GA4 Measurement Protocol (plain `fetch`; MV3 bans remote scripts/`gtag.js`). Owns an anonymous per-install `client_id` (`chrome.storage.local`) and a 30-min `session_id` (`chrome.storage.session`). `popup.js` fires a fixed, closed set of event names at the entry/activation/feature-use points. **Privacy contract — do not break:** `track()` takes only a hardcoded event-name string; payloads carry just the anonymous id, session id, engagement hint, and `ext_version`. Never pass flow content, metadata, org/host names, labels, counts, or the `sid`. This is what keeps the extension in Google's "anonymous usage analytics → no user consent required" category. Credentials (`MEASUREMENT_ID`, `API_SECRET`) are placeholders to fill from a GA4 Web data stream. Telemetry is fire-and-forget (wrapped in `try/catch`) and must never surface to the user or block a feature.

### Key concepts that span files

- **Salesforce ID prefixes are central:** `300` = Flow Definition, `301` = Flow Version. Code repeatedly resolves Definition → active/latest Version before acting. Preserve this distinction in any new query or feature.
- **Fix Nomenclature is the only write path.** `popup.js#fixNomenclature` renames elements to conventions (`var_`, `formula_`, `CONST_`+snake-case, `get_` for lookups) and rewrites every reference via a deep string replace, then `FlowService.deployFlow` PATCHes it back and reopens the new version. It **refuses to deploy when the flow version is Active** — guard this; never deploy over an active version.
- **`extractNonNullProperties` is duplicated** in both `utils.js` and the bottom of `flow-service.js`. This duplication exists in the published build; only consolidate it as a deliberate, separate change.
- **Adding analytics events:** add a new fixed event-name string to the taxonomy and call `track("the_name")` at the relevant code path. Keep names lowercase_snake_case and parameter-free. Never widen `track()` to accept dynamic values derived from flow/org data — distinct event names instead of params is what guarantees the no-data privacy contract.

## Repo conventions

- The repo previously held stale duplicate copies of the extension at the root and a predecessor `Flow XML Downloader/`; these were removed. Keep a **single** extension under `Flow MetaData Downloader/` — do not reintroduce root-level `popup.*`/`styles.css` or committed `.zip` archives.
- When syncing from a published `.crx`/zip, the `_metadata/verified_contents.json` is a Web Store signing artifact, not source — do not commit it.
