---
name: bicep
description: Create, modify, review, and validate Azure infrastructure written in Bicep. Use for Bicep files, Azure IaC plans, resource definitions, modules, parameters, RBAC, managed identities, deployment validation, or infrastructure requirements. Applies current Microsoft schemas, Azure Verified Modules, security guidance, and cost-conscious defaults.
---

# Bicep

Use this workflow for every Bicep planning, implementation, or review task.

## Sources of truth

1. Read the applicable repository requirements and existing Bicep files.
2. Consult current Microsoft Learn documentation and the current Bicep resource
   schema before choosing resource properties or API versions.
3. Use the
   [Azure Verified Modules registry](https://azure.github.io/Azure-Verified-Modules/)
   as the preferred module source when an available module supports the required
   configuration. Pin module versions.
4. Use direct resource declarations when an Azure Verified Module cannot express
   a requirement. Do not guess unsupported properties.
5. Treat [Microsoft Bicep best practices](https://learn.microsoft.com/azure/azure-resource-manager/bicep/best-practices)
   and the [Bicep linter](https://learn.microsoft.com/azure/azure-resource-manager/bicep/linter)
   as required guidance.

If repository requirements conflict with current Azure capabilities, stop and
report the conflict rather than silently changing the design.

## Design

- Match the deployment scope established by the requirements.
- Keep the entry-point Bicep file focused on orchestration. Extract a module when
  it owns a coherent resource group, reduces duplication, or improves testing.
- Use lower camel case for symbolic names, parameters, variables, and outputs.
- Use descriptive symbolic names that represent resources, not resource-name
  strings.
- Prefer symbolic references and implicit dependencies over `resourceId()`,
  `reference()`, and explicit `dependsOn`.
- Use explicit dependencies only when Azure requires ordering that a symbolic
  reference cannot express.
- Use the `parent` property for child resources.
- Avoid fixed module deployment names when concurrent deployments are possible.
- Use deterministic resource names based on meaningful prefixes and
  `uniqueString()` with a stable scope.
- Use current stable API versions supported by the target region. Use preview
  APIs only when a required feature has no stable API, and document why.

## Parameters and outputs

- Parameterize values that vary by environment; use variables for derived or
  invariant values.
- Give every parameter and output a useful `@description`.
- Add length, range, and validation decorators where they prevent invalid
  deployments.
- Use safe, low-cost defaults. Use `@allowed` only when restricting values is an
  intentional requirement.
- Mark secret inputs with `@secure()` and never give them defaults.
- Prefer secret references and managed identities over secret parameters.
- Never output secrets, access keys, connection strings, tokens, signed URLs, or
  values returned by `listKeys()`. Use `@secure()` only when a sensitive output
  is unavoidable.
- Output resource properties such as `defaultHostName` instead of reconstructing
  values.

## Security and identity

- Prefer managed identities and Azure RBAC over credentials, shared keys, and
  access policies.
- Assign the narrowest built-in role at the narrowest resource scope.
- Give role assignments deterministic `guid()` names and set `principalType`.
- Disable public data access, local authentication, and shared-key access when
  the requirements and service support it.
- Require HTTPS and the newest broadly supported minimum TLS version.
- Never place secret values in Bicep files, parameter files, tags, outputs, or
  deployment scripts.
- Provision Key Vault secret containers and references separately from secret
  values unless the requirements explicitly define a secure bootstrap process.
- Do not add private endpoints, virtual networks, firewalls, or other paid
  controls unless required by the approved design.

## Reliability, observability, and cost

- Make deployments repeatable and idempotent.
- Use tags consistently for application, environment, and ownership.
- Configure diagnostics only when the requirements define a destination and
  retention policy.
- Avoid duplicate telemetry routes that increase ingestion costs.
- Choose consumption-based services and the smallest suitable SKU for
  low-traffic workloads.
- Set explicit scaling limits and avoid always-on capacity unless justified by a
  latency or availability requirement.
- Do not provision speculative resources.

## Azure Functions Flex Consumption

When the requirements select Azure Functions Flex Consumption:

- Use the `FC1` SKU and Linux.
- Use `functionAppConfig` for runtime, deployment storage, and scaling.
- Configure deployment storage as a private blob container.
- Prefer identity-based access for deployment and host storage.
- Create required storage role assignments before the Function App consumes the
  deployment container.
- Set explicit instance memory and maximum instance count.
- Configure always-ready instances only when explicitly required.
- Keep application packaging, code deployment, and trigger implementation
  separate from infrastructure provisioning unless the request includes them.

Use the current
[Microsoft JavaScript Flex Consumption sample](https://github.com/Azure-Samples/functions-quickstart-javascript-azd/tree/main/infra)
as implementation reference, while preserving repository requirements.

## Validation

Run the narrowest applicable checks in this order:

1. Format changed files with `az bicep format`.
2. Run `az bicep lint`.
3. Compile with `az bicep build`.
4. If authenticated Azure context and deployment parameters are available, run
   deployment validation.
5. Run `what-if` before deployment and inspect replacements, deletions, role
   assignments, and secret-bearing values.

Treat linter warnings in changed files as failures unless a documented,
requirement-specific exception is necessary. Never deploy or change live Azure
resources unless the user explicitly requests it.

## Review checklist

- Every requirement maps to a resource, property, role assignment, parameter,
  output, or documented non-Bicep responsibility.
- Resource dependencies and scopes are correct.
- Defaults are secure and cost-conscious.
- No secrets can enter deployment history or ordinary outputs.
- Names are valid, deterministic, and stable across unchanged deployments.
- Repeated deployment produces no unintended changes.
- Validation covers compilation and, when possible, Azure validation and
  `what-if`.
