# Telegram Mini App infrastructure proposal

**Status:** Proposal, 26 September 2026. This repository already runs a Telegram bot webhook on Azure Functions Flex Consumption with a user-assigned managed identity, Key Vault, Application Insights, and a Standard LRS StorageV2 account ([current deployment](../../deployment/main.bicep)). It does **not** yet implement a Mini App or user settings. [Mini App V1](../functional-requirements/002-telegram-mini-app.md) is a standalone Hello World frontend; the settings design and 1,000-user estimates below describe a **later phase**, not V1.

## Decision

Use **Azure Static Web Apps (Free)** for the HTTPS frontend, the **existing Azure Functions Flex Consumption app** for the settings API, and **Azure Table Storage (Standard LRS)** in the existing storage account for server-side settings. Do not use Blob Storage as the settings database: it is better suited to files, not indexed per-user settings. Do not deploy another API host, VM, SQL database, or Cosmos DB just for this pilot.

```
Telegram client -> Static Web Apps (frontend)
                -> existing Function App /api/settings -> Azure Table Storage
                                                   (managed identity, private table)
```

The Mini App sends Telegram's raw `initData` to the API on each request. The API validates its signature with the existing bot token from Key Vault, checks `auth_date` against a short configured maximum age, extracts the verified Telegram user ID, and only then reads or writes that user's settings. Never trust `initDataUnsafe`, a client-supplied user ID, or a browser-side storage credential. Give the existing Function identity **Storage Table Data Contributor** access scoped to the settings table (or storage account if table-level assignment is impractical), and access Table Storage via its identity, not an account key. This fits the current account's `allowSharedKeyAccess: false` setting. Do not make the table public or expose credentials to the frontend. Configure CORS on the Function App to permit only the Mini App origin, including preflight requests; CORS is not authentication. Static Web Apps' built-in authentication is not a substitute for Telegram `initData` verification.

Model one entity per user in a `UserSettings` table: `PartitionKey = "user"` and `RowKey = verified Telegram user ID`, with a small, allowlisted settings payload and schema version. Provide `GET /api/settings` (defaults when the record does not exist), `PUT /api/settings` (validated fields and bounded payload), and optionally `DELETE /api/settings` for account deletion. Return an ETag on reads and require `If-Match` for updates so simultaneous devices do not silently overwrite one another. Never store the bot token, payment details, or other secrets in settings. Avoid storing profile data unless required. Table Storage indexes partition and row keys, but has no general secondary indexes; reconsider the data model if the product needs cross-user queries.

### Why this combination

| Choice | Pilot fit | Trade-off |
| --- | --- | --- |
| Static Web Apps Free + existing Function + Table Storage | Reuses the bot's identity, Key Vault, Function App, and storage account; static hosting has no standing charge within Free limits; cheap point lookups. | Different frontend/API origins require restricted CORS; no SLA on Free; shared Function workload must be monitored. |
| Static Web Apps Free + managed API + Table Storage | Same-origin `/api`, convenient frontend/API deployment. | Duplicates existing backend; managed API has no managed identity or Key Vault references, incompatible with the current storage account's shared-key-disabled policy. |
| Blob static website + existing Function + Table Storage | Viable if static assets must be hosted in Storage. | More HTTPS/custom-domain work; still needs CORS; not simpler for this new Mini App. |
| Cosmos DB free tier | Useful for richer querying/global distribution if a free-tier account is available. | Free tier is **not available for serverless accounts** and must be enabled at account creation; more capacity than simple settings require. |
| Telegram CloudStorage or device storage alone | Potentially sufficient for small, Telegram-only preferences. | Platform-specific behavior and limits; not the default if the bot/API needs durable, independently managed server-side settings. |

## V1 build and deployment contract

This section extends the bot-only [hosting contract](001-azure-hosting.md), without changing the existing webhook, bot build, or protected release gate. **Implement these requirements when implementing Mini App V1; this proposal does not itself deploy anything.**

### Infrastructure and delivery

- Provision one **Azure Static Web App (Free)** with the repository's resource-group-scoped Bicep, using a deterministic name and existing environment tags. Output its non-secret name and HTTPS hostname. Do **not** link an API to this Free app, provision Table Storage for V1, or embed credentials in Bicep outputs. Infrastructure creation alone does not publish frontend content.
- Keep the current `master`-push-only CI bundle naming (`ci-<run-id>.<run-attempt>-<short-sha>`), 30-day retention, and full commit/run/attempt provenance. CI must run the existing Bicep, bot type-check, tests, and build **plus** the Mini App type-check and Vite production build on PRs and pushes. Validate the generated `mini-app/dist/index.html` and referenced asset files before packaging.
- On a successful `master` push, include the prebuilt site as `mini-app/` (containing `index.html` and assets) **inside the same versioned CI bundle** as `function-app.zip`, compiled ARM template/parameters, and `metadata.json`. Increment the bundle metadata schema version from `1` to `2`, and require the new version and nonempty Mini App payload in the deploy workflow; old bundles must fail explicitly rather than silently omitting the site. Do not publish production deployment bundles from PR builds.
- Keep the existing manual, environment-protected deploy workflow: resolve the latest successful `master` CI run, pin its run ID, attempt, and SHA, and download only that run's retained bundle. Before Azure mutations, verify metadata and **all** required payloads, including a coherent static site and referenced files. Do not check out code or rebuild the frontend, Function App, or Bicep in deploy.
- After deploying the bundled infrastructure, publish `bundle/mini-app/` to the **production** Static Web App using a pinned deployment tool (for example, Static Web Apps CLI). Authenticate the workflow to Azure with its existing GitHub OIDC identity; obtain the Static Web App deployment token at deployment time, mask it and pass it only as a process environment variable. Never commit or print the token, put it in the release artifact, or pass it on a command line. The deploy identity must have only the permissions needed to provision the declared resources and retrieve that app's deployment token. Keep deployment serialized by environment.
- Preserve deployment of the existing `function-app.zip` from the **same** pinned bundle. Fail the workflow if either application deployment fails; do not report a partial release as successful or fall back to a different bundle. After publishing, verify the Static Web App's HTTPS endpoint responds and serves the version's entry page and assets; report the non-secret URL. An operator then registers the URL through BotFather. This does not change the existing Telegram webhook or automatically edit its menu configuration.

**V1 acceptance:** A successful protected deployment makes the Hello World site available at the provisioned HTTPS endpoint, from the same commit as the deployed bot package and Bicep template. A missing/expired bundle, invalid metadata, missing static asset, token retrieval failure, or site deployment failure produces a failed workflow with no silent skip. The deployment workflow never builds the app. Tests that validate the bundle and deploy gate should cover both compatible and incompatible artifact layouts.

The current Free-plan frontend and separate Function App remain distinct origins. **V1 makes no settings API calls and needs no API authentication or CORS configuration.** When settings are introduced, implement the Telegram `initData` validation and origin policy described above in a separately reviewed change. The under-$1 estimate below assumes that later settings phase and does not include a production Standard-plan/session-based authentication design.

## Cost model (USD, East US example)

Assume 1,000 monthly users, **20 app opens per user per month**, **1 MB of frontend assets transferred per open**, **two API reads per open**, **four settings writes per user per month**, and **2 KB of stored data per user**. These are estimates, not observed usage. Assume East US USD pay-as-you-go rates, Standard LRS, no other Static Web Apps consuming shared free bandwidth, and enough **remaining** Functions free grant after bot traffic.

| Monthly meter | Calculation | Estimated charge |
| --- | --- | --- |
| Static Web Apps Free | 20,000 opens x 1 MB = ~20 GB transfer, below the documented 100 GB/month **per subscription** included bandwidth; app bundle must fit the plan's 250 MB per-environment limit. | $0 while within Free limits |
| Existing Flex Consumption API | 20,000 x 2 + 1,000 x 4 = **44,000 requests**; at a hypothetical 200 ms and the deployed 2 GB instance size, about **17,600 GB-s**. The Flex Consumption on-demand monthly free grants are **250,000 executions and 100,000 GB-s per subscription**, shared with the existing bot and other Flex apps; no Always Ready assumed. | $0 incremental if both remaining grants suffice |
| Table operations | 44,000 x $0.00036 / 10,000 operations, Standard LRS East US reference rate. | ~$0.0016 |
| Table capacity | 1,000 x 2 KB = ~0.002 GB x $0.045/GB-month; allow more for entity/index overhead. | ~$0.0001 before overhead |

**Working estimate: under $1/month *incremental Azure usage* for this narrow pilot**, with a few cents for Table Storage at the assumed volume. This is **not a guaranteed bill or a hard cap**: paid bandwidth/plan upgrade, the existing bot's baseline resources and traffic, DNS/domain registration, logging/Application Insights, backups, network egress, taxes, GitHub Actions, and other subscription workloads are excluded. Key Vault and telemetry already exist, but extra operations/ingestion can still add costs. A production SLA requires a paid Static Web Apps plan. The small unit price of settings storage means frontend traffic, observability, and bot/API compute will dominate total cost. Recalculate using the actual region/subscription, remaining free grants, real bundle size, and measured API duration before deployment.

Sensitivity: at 10,000 users with the same behavior, frontend transfer would be ~200 GB/month, **over the Free plan's 100 GB/month per-subscription allowance**; plan a Standard upgrade and recalculate its hourly charge and bandwidth overage. The settings API would receive ~440,000 requests (over the Flex free execution grant even before bot requests) and consume ~176,000 GB-s at the hypothetical duration and 2 GB size. The settings-only Table portion would still be roughly 440,000 operations (~$0.016) and ~0.02 GB (~$0.001), excluding overhead. An increase in image size or opens per user can trigger the hosting limit much earlier.

## Operations and upgrade path

1. After V1, add the HTTP settings endpoint to the existing Function App. Validate Telegram `initData` on **every** settings call, reject stale or malformed data, limit request size, and authorize only the verified user. Reuse the current Key Vault bot token reference; never place secrets in CI logs or client code.
2. Add a table and least-privilege identity role assignment to the existing `deployment/main.bicep`; configure restricted Function App CORS for the already deployed frontend. Add API tests for signature, expiry, user isolation, validation, and ETag conflicts.
3. Set an Azure Cost Management budget with alerts and monitor bandwidth, API errors/latency, and storage transactions. **Budget alerts do not stop spend.** Keep telemetry sampled/retained to a deliberate limit if Application Insights is enabled.
4. Decide a recoverability target before real user data matters: LRS is not a backup and deletes/overwrites replicate. For an expendable pilot, document that preferences may be reset after loss; otherwise arrange and test a separate periodic export/restore or a stronger backup strategy, including its cost. Upgrade Free to Standard if an SLA, larger bandwidth, or a same-origin integration with the existing Function App is needed; **bring-your-own APIs under SWA `/api` require Standard**.

## Sources

- [Azure Static Web Apps plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans) and [quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas) (Free plan limits, SLA, bandwidth).
- [Static Web Apps pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) and [Azure Functions pricing](https://azure.microsoft.com/en-us/pricing/details/functions/) (free API execution references; eligibility and limits depend on configuration).
- [Azure Static Web Apps Functions integration](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions) and [API options](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview) (managed identity and bring-your-own limitations).
- [Deploy Static Web Apps with Bicep](https://learn.microsoft.com/en-us/azure/static-web-apps/publish-bicep) and [deploy a prebuilt site with the Static Web Apps CLI](https://learn.microsoft.com/en-us/azure/static-web-apps/static-web-apps-cli-deploy) (resource provisioning and deployment-token handling).
- [Azure Table Storage pricing](https://azure.microsoft.com/en-us/pricing/details/storage/tables/) and [Azure Retail Prices API](https://prices.azure.com/api/retail/prices?$filter=serviceName%20eq%20%27Storage%27%20and%20armRegionName%20eq%20%27eastus%27%20and%20contains(productName,%27Tables%27)) (East US Standard LRS rates retrieved 26 September 2026).
- [Table Storage design](https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-design) (keys, indexes, ETags) and [Azure Storage redundancy](https://learn.microsoft.com/en-us/azure/storage/common/storage-redundancy) (LRS trade-offs).
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app) (`initData` verification).
- [Cosmos DB free tier](https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier) (serverless exclusion).
