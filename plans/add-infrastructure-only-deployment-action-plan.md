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

### Entry 3: User decision

- **Actor:** User
- **Decision or result:** Exact user decision received:

  > Implement the plan:
  >
  > 1. Add a manually triggered GitHub Actions workflow that deploys only the existing Bicep infrastructure:
  >    - Authenticate to Azure using OIDC, without stored credentials.
  >    - Run Bicep lint/build, Azure validation, and what-if before deployment.
  >    - Prevent concurrent deployments to the same target.
  >    - Exclude application builds, publishing, and secret provisioning.
  >
  > 2. Document prerequisites: an existing resource group, Azure federated identity, deployment permissions, and GitHub environment configuration.
  >
  > 3. Validate workflow syntax, Bicep compilation, and infrastructure-only scope without deploying live resources.
  >
  > **Current stage:** Planning
  > **Task progress:** 0 of 3 tasks implemented
  > **Last action:** Planner recorded the proposed plan.
  > **Next action:** Choose **implement with Developer** or **review with Reviewer**.
- **Task progress:** 0 of 3 tasks implemented
- **Next action:** Developer implements the explicitly approved plan without live Azure operations.

### Entry 4: Implementation result

- **Actor:** Developer
- **Received user decision:** Implement the approved three-task plan: add a manually dispatched, OIDC-authenticated, infrastructure-only Bicep workflow; document Azure/GitHub prerequisites; and validate syntax, Bicep compilation, and scope without a live deployment.
- **Decision or result:** Completed Task 1, Task 2, and Task 3 without dispatching the workflow or performing Azure control-plane/data-plane operations. Added a manual-only workflow with `contents: read` and `id-token: write`, target-specific concurrency, environment-scoped OIDC configuration, ordered lint/build/validate/what-if stages, and a separately protected Bicep deployment job. Documented existing-resource-group bootstrap, federated identity, resource-group-scoped resource and role-assignment permissions, environment variables/protection, dispatch operation, and infrastructure-only exclusions.
- **Tasks completed:** Task 1: Add the infrastructure deployment workflow; Task 2: Document Azure and GitHub bootstrap; Task 3: Validate the workflow without deploying.
- **Files changed:** `.github/workflows/deploy-infrastructure.yml` (new), `README.md`, `docs/operational-requirements/001-azure-hosting.md`, and this append-only plan ledger.
- **Validation commands and outcomes:**
  - `az bicep version` — exited 0; Bicep CLI `0.46.1 (545b338e2c)`.
  - `az bicep lint --file deployment/main.bicep` — exited 0 with no output or warnings.
  - `az bicep build --file deployment/main.bicep` — exited 0 with no output; generated `deployment/main.json` was removed after compilation.
  - Ruby `Psych.parse_file` against `.github/workflows/deploy-infrastructure.yml` — exited 0 with `workflow YAML parsed successfully`.
  - Node static workflow assertions for required trigger/permissions/OIDC/Bicep commands, command order, input handling, and forbidden automatic/application/secret-provisioning content — exited 0 with `workflow scope, command order, and input handling checks passed`.
  - `git diff --check` — final run exited 0 with no output. An initial run identified trailing spaces in the exact-decision ledger quotation; those formatting defects were removed before the final run.
  - Changed-file `grep -En` secret-pattern scan covering the workflow, documentation, and plan ledger — exited 0 with `all changed-file secret pattern scan passed`; `gitleaks`, `detect-secrets`, and `trufflehog` were unavailable.
  - `git status --short` — only the expected workflow, documentation, and ledger changes remain; no generated Bicep JSON remains.
  - One intermediate combined YAML/static-check shell command exited 1 with Bash `bad substitution` because the test command allowed shell expansion of a GitHub expression; the command was corrected, then the same YAML and static constraints passed.
- **Unavailable validation tooling:** `actionlint`, `parallel_validation`, and `codeql` were not available, so `parallel_validation` with CodeQL `isTrivial: false` could not be invoked. No dedicated Bicep skill tool was exposed; validation used the repository-established Azure CLI Bicep commands. Workflow syntax and semantics received the structured local checks listed above.
- **Blockers, failures, or remaining tasks:** No blockers or remaining implementation tasks. Azure `validate`, `what-if`, and `create` were intentionally not run locally because they require authorized OIDC dispatch and the plan prohibits live Azure operations during implementation.
- **Proposed commit message:** `Add infrastructure-only Azure deployment workflow`
- **Task progress:** 3 of 3 tasks implemented
- **Next action:** Commandeer requests Reviewer review of the code changes; Developer appends the final completion entry only after Reviewer approval is confirmed.

## Review: Code Changes for Add Infrastructure-Only Deployment Action

**Status:** APPROVED

**User decision:** Review the implemented code changes against the approved plan, including OIDC, target-isolated concurrency, approval/what-if ordering, input safety, deployment command compatibility, and infrastructure-only scope.

**Summary:** The implementation satisfies the approved three-task plan. The manual-only workflow safely supplies its resource-group input as a quoted environment variable, uses environment-scoped OIDC configuration, serializes like targets, and makes the protected deployment depend on the completed validation and what-if job.

**Strengths:** `.github/workflows/deploy-infrastructure.yml` grants only `contents: read` and `id-token: write`, uses `azure/login@v2` without a stored cloud credential, and confines Azure commands to the existing resource-group-scoped Bicep entry point and parameter file. The ordered lint, build, validate, what-if, and create stages are fail-fast; the deployment name includes the run ID. `README.md` and `docs/operational-requirements/001-azure-hosting.md` consistently document the existing-resource-group bootstrap, federated identity, role-assignment capability, environment variables/protection, and exclusion of application and secret/webhook operations.

**Issues:** None.

**Recommendations:** Before the first production dispatch, configure required reviewers on the selected GitHub environment and federate the identity subject to that exact repository/environment combination as documented.

**Next Steps:** Task progress is 3 of 3 tasks implemented. Commandeer should proceed with final approval handling: have Developer append the required completion record, then stop for the user's manual commit decision.

### Entry 5: Final completion

- **Actor:** Developer
- **Received user decision:** Read the APPROVED code review and append only the required final completion record; do not change implementation or rerun validation. Record that the required progress tool already committed the implementation, so no manual commit remains necessary.
- **Accomplishment summary:** Completed all approved work for the infrastructure-only deployment action: added the manual OIDC-authenticated Bicep workflow, documented Azure and GitHub bootstrap requirements, and validated its syntax, Bicep compilation, security boundaries, and infrastructure-only scope without deploying live resources.
- **Files changed:** `.github/workflows/deploy-infrastructure.yml`, `README.md`, `docs/operational-requirements/001-azure-hosting.md`, and this append-only plan ledger.
- **Final review status:** APPROVED. The Reviewer reported no issues and confirmed the implementation satisfies all three approved tasks.
- **Validation summary and limitations:** The implementation validations recorded in Entry 4 passed, including Bicep lint/build, YAML parsing, static workflow assertions, diff checking, and the available secret-pattern scan. `actionlint`, `parallel_validation`, CodeQL, and dedicated secret-scanning tools were unavailable. Azure `validate`, `what-if`, and `create` were intentionally not run locally because they require an authorized manual OIDC dispatch; no tests, linters, or builds were rerun for this completion entry.
- **Commit status:** The implementation was committed by the required progress tool; no manual commit remains necessary.
- **Proposed commit message:** `Add infrastructure-only Azure deployment workflow`
- **Task progress:** 3 of 3 tasks implemented and approved.
- **Next action:** Commandeer reports the completed and approved workflow to the user; no implementation, review, or manual commit action remains.
