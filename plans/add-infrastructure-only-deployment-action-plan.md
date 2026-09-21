## Plan: Add Infrastructure-Only Deployment Action

Add a minimal, manually triggered GitHub Actions workflow that authenticates to Azure with OpenID Connect, validates the existing resource-group-scoped Bicep, previews changes, and deploys only `deployment/main.bicep`. Keep application build/publishing, secrets, webhook registration, resource-group creation, and live deployment during implementation out of scope.

**Tasks**
1. **Task 1: Add the infrastructure deployment workflow**
   - **Objective:** Provide a least-privilege, auditable first-iteration workflow that deploys the existing Bicep without deploying application code.
   - **Files to change:** `.github/workflows/deploy-infrastructure.yml` (new)
   - **Steps:**
     1. Add a descriptive workflow name and a `workflow_dispatch` trigger only, with no automatic push or pull-request deployment trigger.
     2. Define required, non-secret dispatch inputs for the existing Azure resource group and GitHub deployment environment, defaulting the environment input to `production`; continue to source the Bicep environment value from `deployment/main.bicepparam` (`prod`) rather than accepting arbitrary template overrides.
     3. Set workflow/job permissions to `contents: read` and `id-token: write`, add deployment concurrency keyed by the selected GitHub environment and resource group, and bind the deployment job to the selected GitHub environment so environment protection rules can gate production.
     4. Check out the repository and authenticate through `azure/login@v2` using GitHub environment variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID`; do not use a client secret, publish profile, Azure credential JSON, or long-lived cloud credential.
     5. Run the Azure CLI commands in fail-fast shell steps, in this order: `az bicep lint`, `az bicep build`, `az deployment group validate`, `az deployment group what-if`, then `az deployment group create`, all against `deployment/main.bicep`, `deployment/main.bicepparam`, and the selected existing resource group. Give the deployment a stable, traceable name that includes the GitHub run identifier.
     6. Keep Node/npm setup, application compilation, package upload, Function App code deployment, Key Vault secret creation, Telegram webhook operations, and resource-group creation absent from the workflow.
   - **Acceptance criteria:** The workflow is valid GitHub Actions YAML; it can only start through manual dispatch; its only permissions are `contents: read` and `id-token: write`; Azure login uses OIDC and no stored cloud secret; lint/build/validate/what-if all precede one resource-group deployment command; every Azure deployment command uses the existing Bicep entry point and parameter file; no step installs, builds, packages, or deploys the Node.js application; concurrent runs targeting the same environment/resource group do not execute simultaneously.

2. **Task 2: Document Azure and GitHub bootstrap**
   - **Objective:** Make the external one-time setup and operating contract explicit without automating privileged bootstrap or creating live Azure resources.
   - **Files to change:** `README.md`, `docs/operational-requirements/001-azure-hosting.md`
   - **Steps:**
     1. Document that an operator must first create the target resource group and an Azure Entra workload identity (application/service principal or user-assigned managed identity) with a GitHub federated credential restricted to this repository and the selected GitHub environment.
     2. Document the required GitHub environment variables (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`), the manual resource-group input, and recommended production environment approval/protection rules; state that these IDs are configuration, not secret-bearing Bicep parameters.
     3. Document that the deployment identity needs resource-group-scoped rights both to manage the declared resources and to create the Bicep-defined role assignments (for example, Contributor plus User Access Administrator), while recommending that bootstrap be performed by an authorized Azure administrator and scoped no wider than the target resource group.
     4. Add manual dispatch instructions and explain the ordered lint, build, validation, what-if, and deployment stages, including the requirement to inspect the what-if output before approving a protected production environment.
     5. Reconcile the operational requirements' current statement that CI/CD is out of scope: infrastructure-only GitHub deployment automation is now in scope, while application publishing/operation and all existing secret/webhook exclusions remain out of scope.
   - **Acceptance criteria:** A maintainer can identify every Azure/GitHub prerequisite and workflow input without inspecting the YAML; the documentation describes secretless OIDC federation and minimum required deployment capabilities; it does not contain tenant, subscription, client, resource-group, token, or webhook-secret values; it clearly distinguishes infrastructure deployment from application deployment and privileged one-time bootstrap.

3. **Task 3: Validate the workflow without deploying**
   - **Objective:** Verify syntax, scope, security boundaries, and Bicep command construction without changing Azure.
   - **Files to change:** No additional files expected; corrections remain limited to the files in Tasks 1 and 2.
   - **Steps:**
     1. Parse or lint the workflow with the repository-available GitHub Actions/YAML validation tooling; if none exists, perform a structured review of trigger, permissions, expressions, environment binding, concurrency, action inputs, and shell quoting.
     2. Run local non-deploying Bicep checks against the existing template: `az bicep lint --file deployment/main.bicep` and `az bicep build --file deployment/main.bicep`.
     3. Review the diff and workflow command list to prove there is no application build/publish step, credential secret, live bootstrap operation, or trigger capable of automatic production deployment.
     4. Do not dispatch the workflow and do not run Azure deployment validation, what-if, or create from the implementation session; authenticated Azure stages are verified only when an authorized operator manually dispatches the completed workflow.
   - **Acceptance criteria:** Workflow syntax review has no errors; local Bicep lint has no warnings and build succeeds; static review confirms OIDC permissions and infrastructure-only scope; implementation causes no GitHub workflow dispatch and no Azure control-plane or data-plane changes.

**Open Questions**
1. None required for implementation. The plan deliberately uses manual dispatch and a protected GitHub environment for the first iteration; automatic branch/path triggers can be considered separately after the initial workflow is proven.
2. Operational blocker (not a code-planning blocker): before a real dispatch can succeed, an Azure administrator must provide an existing resource group, configure the federated identity, grant resource-management and role-assignment permissions at that resource-group scope, and configure the three GitHub environment variables. No Azure identifiers or credentials are required in source control.

## Ledger

### Entry 1: Original request

- **Actor:** User
- **Decision or result:** "need to add deployment action for the first iteartiion it have to depoloy only bicep infra"
- **Task progress:** 0 of 3 tasks implemented
- **Next action:** Planner researches repository requirements, Bicep infrastructure, workflow constraints, and validation configuration.

### Entry 2: Planning result

- **Actor:** Planner
- **Decision or result:** Created a minimal infrastructure-only plan based on the existing resource-group-scoped `deployment/main.bicep` and `deployment/main.bicepparam`. Repository choices remain unchanged: Node.js 22, npm, TypeScript ES modules, and Azure Functions Flex Consumption; the workflow intentionally does not invoke the application toolchain. No existing workflow or repository workflow-validation tool was found. The plan uses manual dispatch, GitHub environment protection, secretless Azure OIDC, narrow GitHub permissions, ordered Bicep lint/build/validate/what-if/create stages, and documents the external Azure bootstrap needed for role-assignment-capable deployments. No live Azure operation is part of implementation validation.
- **Task progress:** 0 of 3 tasks implemented
- **Next action:** Commandeer presents the plan and waits for the user's explicit choice of Developer implementation or Reviewer plan review.
