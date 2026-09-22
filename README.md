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

### Manual infrastructure deployment

The **Deploy Azure infrastructure** GitHub Actions workflow deploys only the
existing Bicep template. It does not build or publish the Node.js application,
create secret values, register a Telegram webhook, or create a resource group.

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

To deploy, open **Actions**, select **Deploy Azure infrastructure**, choose
**Run workflow**, enter the existing resource-group name, and select the GitHub
environment. The workflow uses OIDC to authenticate, then runs Bicep lint,
build, Azure validation, and what-if before a separate deployment job. Because
the Azure IDs are environment-scoped, approve the validation job first; then
inspect its what-if output before approving the protected deployment job. Runs
for the same environment and resource group are serialized.

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