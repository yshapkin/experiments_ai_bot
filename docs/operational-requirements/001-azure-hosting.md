# Azure infrastructure

**Last reviewed:** 2026-09-23

## Overview

Provision the minimum Azure infrastructure required to host the Telegram bot as
a Node.js Azure Function. Infrastructure must be defined in Bicep and optimized
for a low-traffic, low-cost production workload.

This document covers the V1 production hosting contract for the existing Bicep
template and its corresponding Azure Functions deployment shape. CI builds and
publishes the deployable application bundle from trusted `master` pushes, while
manual deployment remains a separate protected workflow step.

## Goals

- Produce repeatable and idempotent resource-group-scoped Bicep deployments.
- Minimize recurring cost while retaining horizontal scaling.
- Keep secrets out of source control, Bicep parameters, outputs, and deployment
  history.
- Provide basic application logs, traces, exceptions, requests, and platform
  metrics.
- Prevent telemetry, logs, and configuration from disclosing bot tokens,
  webhook secrets, request bodies, headers, or other sensitive URLs.

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
- Expose an explicit bootstrap option that can create the required Telegram
  secrets with empty-string values and can be omitted on ordinary redeployments
  so operator-managed values are not overwritten.
- Use versionless Key Vault references in Function App settings.
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
- Set `telemetryMode` to `OpenTelemetry` in `host.json`.
- Start the Node.js worker with the Azure Monitor OpenTelemetry ESM loader.
- Export application console logs at `info`.
- Disable Node.js outbound HTTP dependency auto-instrumentation so telemetry
  does not emit Telegram Bot API dependency URLs that embed the bot token in
  the path.
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
  - `instanceMemoryMB`: `2048`.
  - `maximumInstanceCount`: `10`.
- Require HTTPS-only access, TLS 1.2 or newer, and disable FTPS.
- Keep the public endpoint enabled because Telegram must reach the function.
- Do not enable App Service Authentication. The application is responsible for
  validating Telegram's webhook secret header.
- Host one stateless bot instance per worker process. Do not run long polling in
  production.
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

## Deployment automation prerequisites

The deployment workflow deploys into an existing resource group. An
authorized Azure administrator must perform this one-time bootstrap outside the
workflow:

1. Create the target resource group.
2. Create a Microsoft Entra workload identity, using either an
   application/service principal or a user-assigned managed identity.
3. Configure a GitHub federated credential whose subject is restricted to this
   repository and the selected GitHub environment.
4. Grant the deployment identity resource-group-scoped rights to manage the
   declared resources and create the role assignments in this template. For
   example, **Contributor** plus **User Access Administrator** at the target
   resource group supplies those capabilities. Do not grant broader scope than
   required.
5. Create the GitHub environment, normally `production`, and add the
   non-secret environment variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and
   `AZURE_SUBSCRIPTION_ID`. Apply required reviewers and appropriate production
   protection rules.

The client, tenant, and subscription IDs are configuration rather than secrets
or Bicep parameters. The workflow uses GitHub OIDC and does not store a client
secret, publish profile, or Azure credential JSON.

The **CI** workflow keeps Bicep format, lint, and build plus `npm ci`,
`npm run typecheck`, `npm test`, and `npm run build` on both pull requests and
pushes. Only successful `master` push runs publish deployable bundles, retained
for 30 days, versioned as `ci-<run-id>.<run-attempt>-<short-sha>`. Each bundle
contains:

- `function-app.zip` with compiled output and production dependencies
- `infrastructure/main.json` compiled from `deployment/main.bicep`
- `infrastructure/main.parameters.json` compiled from
  `deployment/main.bicepparam`
- `metadata.json` recording the version, full commit SHA, CI run ID, and CI run
  attempt

An operator manually dispatches **Deploy Azure Function**, supplies a CI
run ID and run attempt from a successful `master` push of the **CI** workflow,
and selects the GitHub environment. The workflow serializes deployments to the
same environment and resource group, verifies that exact attempt completed the
validation and publish jobs successfully, confirms the retained artifact and its
metadata, then deploys the compiled ARM template and prebuilt application ZIP.
It does not check out the repository, build application code, compile Bicep,
package dependencies, lint, test, type-check, or run Azure validation or
what-if. The bundled parameter file still fixes `environmentName` to `prod`.

This automation does not create the resource group or deployment identity,
assign bootstrap permissions, provision secrets, rebuild or repackage
application code, or operate the Telegram webhook.

## Application deployment and operations

- CI is the sole production builder. Operators deploy only retained CI bundles.
- The deployment package must include at least:
  - `dist/`
  - `host.json`
  - `package.json`
  - `package-lock.json`
  - production-only `node_modules/`
- `package.json` must point Azure Functions at the compiled function entrypoints
  under `dist/functions/*.js`.
- Deploy the compiled `infrastructure/main.json` and
  `infrastructure/main.parameters.json` files from the selected CI bundle rather
  than recompiling Bicep during deployment.
- The production Function App route is `POST /api/telegram/webhook`.
- Operators register or rotate the Telegram webhook separately after publishing
  code and populating the Key Vault secrets. Runtime code must not call
  `setWebhook` during cold start.
- Empty-string bootstrap secrets are placeholders only. The application still
  fails startup until operators replace them with non-blank secret values.
- The webhook URL is fixed and non-secret; the request secret is enforced only
  through the `X-Telegram-Bot-Api-Secret-Token` header.
- Telegram retries failed or ambiguous deliveries, so duplicate updates are an
  expected operational condition for V1.
- The Telegram Bot API is a deliberate protocol exception because Telegram
  requires the bot token in the outbound API path. Production telemetry must not
  export those dependency URLs.

## Acceptance criteria

- `az bicep build` completes without errors.
- CI preserves the existing validation checks on pull requests and pushes.
- Only successful `master` push CI runs publish deployable bundles.
- Each published bundle records the full commit SHA, CI run ID, and CI run
  attempt and expires after 30 days.
- The manual deployment workflow consumes an explicitly selected CI run ID and
  run attempt, verifies their provenance, and does not rebuild artifacts.
- Repeating the deployment with unchanged parameters produces no modifications.
- The Function App uses the `FC1` plan, Node.js 22, 2,048 MB instances, a maximum
  of 10 instances, and zero always-ready instances.
- The Function App can access deployment storage, Key Vault secrets, and
  Application Insights through its managed identity.
- The Function App settings use versionless Key Vault references for
  `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`.
- The storage account and Key Vault reject unauthenticated data-plane access.
- No deployed configuration or output contains the Telegram bot token or
  webhook secret.
- Application Insights is linked to the Log Analytics workspace with 30-day
  retention.
- An explicit bootstrap deployment path exists for creating empty-string Key
  Vault secret placeholders without forcing later redeployments to overwrite
  operator-populated secret values.

## Limitations

- Scale-to-zero can introduce cold-start latency; this is accepted to minimize
  cost.
- Public service endpoints are used to avoid private-networking charges.
- The instance limit constrains peak throughput to control cost.
- Application Insights sampling may omit individual telemetry events.
- Live webhook registration and Azure deployment validation require operator
  credentials and are not demonstrated in-repo.

## Out of scope

- Pipeline redesign, queues, durable state, databases, or duplicate-suppression
  infrastructure.
- Virtual networks, private endpoints, NAT Gateway, and other private-network
  hosting changes.
- Creating the Azure resource group or assigning deployment permissions.
- Automatic deployment triggers and application deployment automation.
- Application-level telemetry sampling configuration.
- Azure Monitor alerts, action groups, dashboards, and workbooks.
- Custom domains, certificates, private networking, and disaster recovery.
