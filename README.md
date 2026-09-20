# experiments_ai_bot

This repository contains a minimal Telegram bot built with Node.js, TypeScript,
and grammY. It welcomes users, provides inline help, and echoes supported text.

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

The bot uses long polling. Keep `.env` local; it is ignored by Git. A missing or
blank `TELEGRAM_BOT_TOKEN` stops startup before polling.

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