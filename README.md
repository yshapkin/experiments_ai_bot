# experiments_ai_bot

This repository contains a minimal Telegram bot built with Node.js, TypeScript,
and grammY. It welcomes users, provides inline help, and echoes supported text.
Local development uses long polling. Production uses an Azure Functions HTTP
webhook.

## Prerequisites

- Node.js 22
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

## MCP servers for development

The workspace configuration in [`.vscode/mcp.json`](.vscode/mcp.json) adds two
servers for VS Code with GitHub Copilot:

- **Azure** runs the pinned `@azure/mcp` npm package through `npx` over stdio.
  It defaults to read-only operations. Use Node.js 22 and npm, install the
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

The [Telegram Mini App infrastructure proposal](docs/operational-requirements/002-telegram-mini-app-infrastructure.md)
evaluates hosting and storage for a future settings feature and its incremental
pilot costs. It has not been implemented.

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
The bundle contains the application ZIP, compiled ARM template and parameter
JSON, and metadata identifying the commit, CI run, and attempt. The **Deploy
Azure Function** workflow deploys only that immutable CI bundle. It does not
check out source or build, lint, test, validate, or run what-if during deploy,
and it does not create secret values, register a Telegram webhook, or create a
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

These identifiers are non-secret configuration; no Azure client secret or
credential JSON is used. Configure required reviewers and other protection
rules on the production environment.

To deploy, select **Deploy Azure Function**, choose **Run workflow**, and
select the GitHub environment. The workflow automatically looks up the most
recent successful `ci.yml` run for a `master` push through the GitHub API, then
pins that run's ID, attempt, and commit and downloads its exact
`ci-<run-id>.<run-attempt>-<short-sha>` bundle—no run ID or attempt number is
entered manually. The workflow verifies the retained bundle's metadata and
required files before using OIDC to deploy its precompiled ARM JSON and
application ZIP. If the latest successful run's bundle is missing, expired, or
incompatible, deployment fails without falling back to an older run. The
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
test/         Unit tests
deployment/   Infrastructure as Code (IaC) using Bicep
```

## Links
- [Infrastructure as Code: IaC](https://learn.microsoft.com/en-us/devops/deliver/what-is-infrastructure-as-code)
- [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview?tabs=bicep)
- [Custom agents in VS Code](https://code.visualstudio.com/docs/agent-customization/custom-agents)
- [Custom agents in GitHub Copilot](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents)
- [Custom agents in GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli)