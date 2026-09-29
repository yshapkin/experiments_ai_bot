# experiments_ai_bot

This repository contains a minimal Telegram bot built with Node.js, TypeScript,
and grammY. It welcomes users, provides inline help, and echoes supported text.
Local development uses long polling. Production uses an Azure Functions HTTP
webhook.

## Prerequisites

- Node.js 24
- npm
- A Telegram bot token created through BotFather

## Local setup

Install the locked dependencies:

```sh
npm ci
```

Copy `.env.example` to `.env`, replace the placeholder with your token, and
export the variable into the shell before starting the bot:

```sh
set -a
. ./.env
set +a
npm run dev
```

The bot uses long polling for local development only. Keep `.env` local; it is
ignored by Git. A missing or blank `TELEGRAM_BOT_TOKEN` stops startup before
polling.

## Mini App frontend

The framework-free TypeScript/Vite source is in `src/mini-app/`. Install the
root dependencies once, then use the root scripts:

```sh
npm run mini-app:dev
npm run mini-app:typecheck
npm run mini-app:build
npm run mini-app:preview
npm run test:mini-app:initialization
npm run test:mini-app:build
```

The production build writes generated static files to the ignored
`mini-app/dist/` directory. `mini-app:preview` serves those files only for
local verification; no production frontend server is deployed.
The two focused test commands validate the initialization lifecycle and a
temporary production build without contacting external services. The aggregate
`npm test`, `npm run typecheck`, and `npm run build` commands below include the
repository-wide checks.

## MCP servers for development

The workspace configuration in [`.vscode/mcp.json`](.vscode/mcp.json) adds two
servers for VS Code with GitHub Copilot:

- **Azure** runs the pinned `@azure/mcp` npm package through `npx` over stdio.
  It defaults to read-only operations. Use Node.js 24 and npm, install the
  [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli), and
  authenticate locally with `az login` using an account with least-privilege
  access to the intended subscription. The first launch downloads the package.
- **Microsoft Learn** connects to `https://learn.microsoft.com/api/mcp` over
  HTTP for Microsoft documentation search and retrieval. It requires internet
  access but no API key or Azure login.

Open this repository in a current VS Code version with MCP support, run
**MCP: List Servers** from the Command Palette, and start each server. Review
the configuration before trusting it, then select its tools in Copilot Chat
agent mode. Keep credentials out of the configuration; Azure uses your local
authentication session. Read-only Azure access can still expose sensitive
resource data, so review tool calls and their output before sharing it.

These servers are development tools, not bot runtime dependencies. This
workspace file does not configure GitHub Copilot CLI or the GitHub Copilot
cloud agent; those clients require their own MCP settings.

## Supported behavior

- `/start` sends one welcome message with a **Help** button.
- **Help** explains the plain-text echo behavior.
- Non-command text in private chats is echoed unchanged.
- Commands other than `/start`, groups, channels, media, and edited messages are
  ignored.

## Validation and production build

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm start` runs the compiled output and requires
`TELEGRAM_BOT_TOKEN` in the environment.

## Production runtime and webhook

- Azure Functions serves `POST /api/telegram/webhook`.
- The webhook URL is fixed and non-secret. Authentication relies on the
  `X-Telegram-Bot-Api-Secret-Token` header value stored in Key Vault.
- Secret-token rejection logs include only header presence, UTF-8 byte lengths,
  and whether the configured value is an unresolved Key Vault reference. They
  never include secret values or hashes.
- Production workers are stateless and do not start grammY long polling.
- The Functions host uses OpenTelemetry mode, while the Node worker exports only
  console logs to workspace-backed Application Insights over managed identity.
  Outbound HTTP dependency auto-instrumentation stays disabled so Telegram Bot
  API URLs containing the bot token are never emitted as telemetry.
- Telegram may retry failed or ambiguous deliveries, so duplicate updates are
  possible in V1.

After publishing the function package and setting both Key Vault secrets, an
operator registers the webhook once with the Telegram Bot API:

```sh
curl --fail --silent --show-error \
  --data-urlencode "url=https://<function-app-host>/api/telegram/webhook" \
  --data-urlencode "secret_token=<telegram-webhook-secret>" \
  "https://api.telegram.org/bot<telegram-bot-token>/setWebhook"
```

Do not perform webhook registration during application startup or on every cold
start.

## Azure infrastructure

The [Telegram Mini App V1 specification](docs/functional-requirements/002-telegram-mini-app.md)
defines a TypeScript + Vite Hello World frontend and its release acceptance
criteria. The [infrastructure proposal](docs/operational-requirements/002-telegram-mini-app-infrastructure.md)
specifies CI artifacts and deployment for V1, plus later settings storage and
pilot costs. The frontend source and local tooling slice, CI static-payload
validation, bundle schema version 2 with the `mini-app/` payload, the
deploy-time structural gate, protected publication of the prebuilt site, and
published-endpoint verification are implemented. The first protected deployment
run, BotFather configuration, and settings remain manual operator actions or out
of scope.

The resource-group-scoped Bicep definition in
[`deployment/main.bicep`](deployment/main.bicep) provisions the low-cost Azure
Functions Flex Consumption hosting resources defined in the
[Azure hosting requirements](docs/operational-requirements/001-azure-hosting.md).
It provisions infrastructure only; publishing the application, creating Key
Vault secret values, and registering the Telegram webhook remain separate
operational steps.

Supply an environment name with the included non-secret parameter file, then
validate or deploy it from a machine authenticated to the target subscription:

```sh
az deployment group validate \
  --resource-group <resource-group> \
  --template-file deployment/main.bicep \
  --parameters deployment/main.bicepparam

az deployment group what-if \
  --resource-group <resource-group> \
  --template-file deployment/main.bicep \
  --parameters deployment/main.bicepparam
```

### Manual production deployment

The **CI** workflow validates every pull request. On a successful push to
`master`, it also creates a versioned deployment bundle retained for 30 days.
The bundle contains the application ZIP, the prebuilt Mini App site under
`mini-app/`, compiled ARM template and parameter JSON, and metadata identifying
the schema version, commit, CI run, and attempt. CI validates the built Mini App
output and the copied bundle payload — entry page, referenced local assets, and
absence of symbolic links — before the bundle is uploaded. The **Deploy
Azure Function** workflow deploys only that immutable CI bundle. It does not
check out source, or build, lint, test, or run what-if during deploy; it
verifies the downloaded bundle's provenance and structure only. It also does
not create secret values, register a Telegram webhook, or create a
resource group.

Before using the workflow, an authorized Azure administrator must:

1. Create the target resource group.
2. Create a Microsoft Entra workload identity (an application/service principal
   or user-assigned managed identity) and add a GitHub federated credential
   restricted to this repository and the selected GitHub environment.
3. Grant the identity resource-group-scoped permissions to manage the declared
   resources and create their role assignments. For example, grant
   **Contributor** and **User Access Administrator** no wider than the target
   resource group.
4. Create the GitHub environment (normally `production`) and define these
   environment variables:
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`
5. Create the environment **secret** `AZURE_STATIC_WEB_APPS_API_TOKEN` on the
   same protected environment, from the Static Web App's deployment token
   (Azure portal: **Static Web App → Overview → Manage deployment token**). The
   workflow exposes it to the Static Web Apps CLI only as the process
   environment variable `SWA_CLI_DEPLOYMENT_TOKEN`; it never retrieves,
   derives, prints, or persists the token, and the deploy identity needs no
   token-retrieval permission. The operator creates and rotates this secret
   manually.
6. Before the first protected run, confirm that the `azure/login` action commit
   pinned in `.github/workflows/deploy.yml`
   (`7184910d9eb2b1c5e48f7073824a90609bb9b6d6`) is the commit behind release
   `v2.3.1`, by dereferencing the annotated tag with
   `gh api repos/Azure/login/git/ref/tags/v2.3.1` and following `object.sha` to
   the tag object's target commit. This check needs network access and is not
   performed by any workflow or test.

These identifiers are non-secret configuration; no Azure client secret or
credential JSON is used. Configure required reviewers and other protection
rules on the production environment.

To deploy, select **Deploy Azure Function**, choose **Run workflow**, and
select the GitHub environment. The workflow automatically looks up the most
recent successful `ci.yml` run for a `master` push through the GitHub API, then
pins that run's ID, attempt, and commit and downloads its exact
`ci-<run-id>.<run-attempt>-<short-sha>` bundle—no run ID or attempt number is
entered manually. The workflow verifies the retained bundle's metadata
provenance and the structural presence of its required files, including
`mini-app/index.html`, before using OIDC to deploy its precompiled ARM JSON and
application ZIP, publish the prebuilt Mini App site to the production Static
Web App with a pinned Static Web Apps CLI version, and verify that the published
HTTPS endpoint serves byte-for-byte copies of the pinned bundle's entry page
and one local asset (retrying the entry page while the site propagates). Deep
reference validation of the static payload is not repeated at deploy time; CI
performs it once before the bundle exists. If the latest successful run's bundle
is missing, expired, or incompatible, deployment fails without falling back to
an older run. A failure after a component was already applied names the applied
components; no rollback is attempted and no partial release is reported as
success. After a successful run, an operator registers the reported HTTPS URL
with BotFather; the repository does not automate that step. The
selected environment's protection rules provide the approval gate, and runs
for the same environment are serialized.

The parameter value `environmentName = 'prod'` remains fixed in
`deployment/main.bicepparam`; the GitHub environment input does not override
Bicep parameters.

### Key Vault secret bootstrap

The Bicep template includes an explicit bootstrap switch for creating the two
required Key Vault secrets with empty-string placeholder values:

```sh
az deployment group create \
  --resource-group <resource-group> \
  --template-file deployment/main.bicep \
  --parameters deployment/main.bicepparam \
  --parameters bootstrapTelegramSecrets=true
```

Use that switch only when you intentionally want ARM to create or reset the
placeholder secrets. Leave it unset or `false` for ordinary redeployments so
operator-populated secret values are not overwritten.

The current `Microsoft.KeyVault/vaults/secrets@2024-11-01` schema declares the
secret `properties.value` as a string without a minimum length, which is the
basis for using an empty string here. Live Azure validation still requires real
deployment credentials.

The placeholders are intentionally blank. The application still refuses to start
until operators replace both secret values with non-blank production values.

### Function package contents

Build before packaging, then publish a package that includes:

- `dist/`
- `host.json`
- `package.json`
- `package-lock.json`

`package.json` points Azure Functions at `dist/functions/*.js`, while
`npm run dev` and `npm start` remain local polling entrypoints.

## Repository structure

```text
.github/      GitHub repository configuration
docs/         Documentation
plans/        Append-only agent workflow plans and execution ledgers
src/          Functional code base
src/mini-app/ Authored Mini App frontend
test/         Unit tests
deployment/   Infrastructure as Code (IaC) using Bicep
```

## Links
- [Infrastructure as Code: IaC](https://learn.microsoft.com/en-us/devops/deliver/what-is-infrastructure-as-code)
- [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview?tabs=bicep)
- [Custom agents in VS Code](https://code.visualstudio.com/docs/agent-customization/custom-agents)
- [Custom agents in GitHub Copilot](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents)
- [Custom agents in GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli)