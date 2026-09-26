# Telegram Mini App V1: Hello World

**Status:** Specification, 26 September 2026. This feature is not implemented yet. See [operational requirement 002](../operational-requirements/002-telegram-mini-app-infrastructure.md#v1-build-and-deployment-contract) for the release contract.

## Goal and scope

Deliver a minimal Telegram Mini App that proves the frontend can be built, published by CI, and deployed through the existing protected Azure deployment workflow. V1 is **only a Hello World screen**; the settings API and storage described in the infrastructure proposal are a later phase.

## Functional requirements

- Use **TypeScript and Vite** with a small, framework-free frontend in `mini-app/`. Keep the repo's Node.js 22 and npm tooling and a single committed lockfile. Build static assets into `mini-app/dist/`; no frontend server runs in production.
- Render a visible **Hello World** heading on first load, with a suitable document title and responsive layout for a Telegram mobile webview. The screen must be usable when opened in a regular browser for development and verification.
- When Telegram's Web App bridge is available, signal readiness after the screen is initialized. Do not require Telegram globals for local browser preview. Host the app on the HTTPS URL of the Azure Static Web App; configure that URL as the bot's Mini App/menu URL through BotFather as a separate operator action after a successful deployment.
- V1 has no user-specific content, settings form, API calls, authentication/session flow, storage, bot command or keyboard changes, analytics, or new paid service dependency. Never place the bot token, webhook secret, Azure deployment token, or other credentials in frontend source, environment variables embedded in the bundle, or generated assets.

## Acceptance criteria

1. `npm ci` followed by the Mini App type-check and build commands succeeds on Node.js 22; `mini-app/dist/index.html` and its referenced assets exist and are nonempty.
2. Opening the built app in a normal browser shows **Hello World** without errors or requiring Telegram or the bot API.
3. Opening the deployed HTTPS URL through Telegram shows the same screen and marks the Mini App ready. Telegram launch configuration is documented but is not changed automatically by CI or deployment.
4. Pull-request CI validates the Mini App alongside the existing bot checks. A successful `master` push publishes its built static files in the **same versioned deployment bundle** as the Function App and infrastructure; no PR produces a deployable production bundle.
5. The existing manually dispatched, protected deployment pins and verifies that exact CI bundle and deploys the prebuilt Mini App as well as the existing Function App. A missing/invalid Mini App payload or failed Static Web Apps deployment fails the workflow rather than reporting success; deployment does not rebuild source or fetch a different commit.

## Deferred

Per-user settings, Telegram `initData` verification, server-side sessions, Table Storage, a settings API, and their costs are future work. The infrastructure proposal's settings traffic estimate is **not** a V1 runtime requirement. No API authentication is needed when the Hello World page makes no API calls.
