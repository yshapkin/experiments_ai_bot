# Azure infrastructure

**Last reviewed:** 2026-09-20

## Overview

Provision the minimum Azure infrastructure required to host the Telegram bot as
a Node.js Azure Function. Infrastructure must be defined in Bicep and optimized
for a low-traffic, low-cost production workload.

This document covers infrastructure provisioning only. Building, publishing,
starting, or otherwise operating the bot application is out of scope.

## Goals

- Produce repeatable and idempotent resource-group-scoped Bicep deployments.
- Minimize recurring cost while retaining horizontal scaling.
- Keep secrets out of source control, Bicep parameters, outputs, and deployment
  history.
- Provide basic application logs, traces, exceptions, dependencies, requests,
  and platform metrics.

## Bicep deployment contract

### Scope and parameters

- Deploy into an existing resource group; creating the resource group is out of
  scope.
- Use the resource group's location by default.
- Accept these parameters:
  - `applicationName`: default `experiments-ai-bot`.
  - `environmentName`: deployment environment used in resource names and tags.
  - `location`: Azure region, defaulting to the resource group's location.
  - `tags`: additional resource tags, defaulting to an empty object.
  - `telegramBotTokenSecretName`: default `telegram-bot-token`.
  - `telegramWebhookSecretName`: default `telegram-webhook-secret`.
- Derive a deterministic suffix with `uniqueString()` to satisfy global naming
  requirements.
- Apply `application`, `environment`, and `managed-by: bicep` tags to resources
  that support tags. Required tags take precedence over supplied tags.
- Use stable resource API versions supported in the selected region.

### Required resources

Provision only these resources:

1. One user-assigned managed identity.
2. One general-purpose v2 storage account.
3. One private blob container for the function deployment package.
4. One Linux Flex Consumption plan.
5. One Linux Function App.
6. One Azure Key Vault.
7. One Log Analytics workspace.
8. One workspace-based Application Insights resource.
9. The role assignments defined in this document.

Do not provision a virtual network, private endpoints, NAT Gateway, API
Management, container registry, custom domain, deployment slot, dashboard,
workbook, alert, or action group.

### Naming

- Use Azure resource abbreviations followed by the application name,
  `environmentName`, and the deterministic suffix.
- Ensure generated names satisfy each resource's length and character rules.
- Storage account names must contain only lowercase letters and numbers.

### Storage

- Use a `StorageV2` account with Standard locally redundant storage (`Standard_LRS`).
- Require HTTPS traffic and TLS 1.2 or newer.
- Disable blob public access and shared-key authorization.
- Enable public network access; private networking is intentionally omitted to
  reduce cost.
- Create one private blob container for Flex Consumption package deployment.
- Grant the managed identity the **Storage Blob Data Owner** role at storage
  account scope.
- Configure `AzureWebJobsStorage` with the managed identity and the blob service
  URI; do not use a storage connection string or account key.

### Key Vault

- Use the Standard SKU and Azure RBAC authorization.
- Enable soft delete and purge protection.
- Require TLS 1.2 or newer.
- Enable public network access; private endpoints are intentionally omitted to
  reduce cost.
- Grant the managed identity the **Key Vault Secrets User** role at vault scope.
- Provision the vault without secret values. Secret creation and rotation are
  out of scope.
- Configure Function App settings named `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_WEBHOOK_SECRET` as Key Vault references to the configured secret
  names.
- Configure the Function App to use the user-assigned identity when resolving
  Key Vault references.

### Log Analytics and Application Insights

- Use the Log Analytics pay-as-you-go SKU with 30 days of retention.
- Create workspace-based Application Insights linked to the workspace.
- Disable Application Insights local authentication.
- Grant the managed identity the **Monitoring Metrics Publisher** role on
  Application Insights.
- Configure `APPLICATIONINSIGHTS_CONNECTION_STRING` and
  `APPLICATIONINSIGHTS_AUTHENTICATION_STRING` for managed-identity
  authentication.
- Use Azure Monitor Metrics for built-in Function App platform metrics. Do not
  create diagnostic settings that duplicate Application Insights telemetry in
  the Log Analytics workspace.

### Flex Consumption plan

- Use the `FC1` SKU with the `FlexConsumption` tier.
- Use Linux and disable zone redundancy.
- Do not configure always-ready instances so the application can scale to zero.

### Function App

- Use Azure Functions runtime v4 with Node.js 22.
- Assign only the user-assigned managed identity.
- Configure `functionAppConfig.deployment.storage` to use the deployment blob
  container and user-assigned identity authentication.
- Configure `functionAppConfig.scaleAndConcurrency` with:
  - `instanceMemoryMB`: `512`.
  - `maximumInstanceCount`: `10`.
- Require HTTPS-only access, TLS 1.2 or newer, and disable FTPS.
- Keep the public endpoint enabled because Telegram must reach the function.
- Do not enable App Service Authentication. The application is responsible for
  validating Telegram's webhook secret header.
- Do not include secret values in application settings.

### Role assignments

Use deterministic `guid()` names and set `principalType` to `ServicePrincipal`
for these assignments:

- **Storage Blob Data Owner** on the storage account.
- **Key Vault Secrets User** on the Key Vault.
- **Monitoring Metrics Publisher** on Application Insights.

Create no role assignments for the deployment operator.
Ensure the storage role assignment is complete before creating the Function App,
because Flex Consumption deployment storage uses that identity.

### Outputs

Return only non-secret values:

- Resource IDs and names for the Function App, Key Vault, storage account,
  Application Insights, and Log Analytics workspace.
- Managed identity client ID and principal ID.
- Function App default hostname and HTTPS base URL.
- Key Vault URI.

Do not output secret values, storage keys, connection strings, or signed URLs.

## Acceptance criteria

- `az bicep build` completes without errors.
- A resource-group deployment validation and what-if operation complete without
  errors.
- Repeating the deployment with unchanged parameters produces no modifications.
- The Function App uses the `FC1` plan, Node.js 22, 512 MB instances, a maximum
  of 10 instances, and zero always-ready instances.
- The Function App can access deployment storage, Key Vault secrets, and
  Application Insights through its managed identity.
- The storage account and Key Vault reject unauthenticated data-plane access.
- No deployed configuration or output contains the Telegram bot token or
  webhook secret.
- Application Insights is linked to the Log Analytics workspace with 30-day
  retention.

## Limitations

- Scale-to-zero can introduce cold-start latency; this is accepted to minimize
  cost.
- Public service endpoints are used to avoid private-networking charges.
- The instance limit constrains peak throughput to control cost.
- Application Insights sampling may omit individual telemetry events.

## Out of scope

- Building, packaging, publishing, starting, stopping, or testing the bot.
- Implementing the Azure Functions HTTP trigger or Telegram webhook handler.
- Registering, updating, or deleting the Telegram webhook.
- Creating or rotating Key Vault secret values.
- Creating the Azure resource group or assigning deployment permissions.
- CI/CD pipelines and application deployment automation.
- Application-level telemetry sampling configuration.
- Azure Monitor alerts, action groups, dashboards, and workbooks.
- Custom domains, certificates, private networking, and disaster recovery.
