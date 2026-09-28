---
name: github-actions
description: Create, modify, review, and validate GitHub Actions workflows and actions for this repository. Use for files under .github/workflows, workflow triggers, jobs, permissions, expressions, matrices, caching, artifacts, environments, concurrency, CI/CD, OIDC, or action version updates. Applies current GitHub Actions documentation, least-privilege security, immutable dependencies, and the repository's build-once deployment model.
---

# GitHub Actions

Use this workflow for every GitHub Actions planning, implementation, or review
task.

## Sources of truth

1. Read the request, repository instructions, affected workflows, scripts called
   by those workflows, and related deployment configuration.
2. Use the current
   [GitHub Actions documentation](https://docs.github.com/en/actions) and
   [workflow syntax reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
   for syntax, contexts, expressions, events, permissions, and platform
   behavior.
3. Consult the documentation for every referenced action and verify its inputs,
   outputs, supported runner versions, and current immutable release commit.
4. Preserve repository conventions unless they conflict with the requirement or
   current GitHub behavior.
5. Load companion repository skills when a workflow operates on their files:
   - `typescript` for Node.js installation, dependency, test, type-check, and
     build steps.
   - `bicep` for Azure infrastructure validation or compilation.
   - `grammy` when workflow behavior depends on the Telegram bot runtime.

Do not guess event payloads, context availability, permission names, action
inputs, or expression behavior. If repository requirements conflict with the
platform, report the conflict rather than implementing a silent workaround.

## Workflow design

- Keep workflow files in `.github/workflows` with a `.yml` extension.
- Give workflows, jobs, and non-trivial steps descriptive names.
- Define the narrowest trigger that satisfies the requirement. Add branch,
  path, tag, and activity filters only when skipped runs are acceptable.
- Treat `pull_request_target`, `workflow_run`, `workflow_call`, and reusable
  workflows as security and trust-boundary decisions, not interchangeable
  trigger shortcuts.
- Never check out or execute untrusted pull-request code in a privileged
  `pull_request_target` job.
- Use `needs` to represent real dependencies. Run independent jobs or steps in
  parallel when doing so does not alter behavior.
- Use a matrix only when every generated combination is useful. Configure
  `fail-fast` and exclusions deliberately.
- Add explicit `timeout-minutes` to jobs so failed tools cannot consume runner
  time indefinitely.
- Use `concurrency` when overlapping runs could publish stale artifacts, deploy
  out of order, mutate the same environment, or waste significant resources.
  Include the relevant ref, pull request, or environment in the group key.
- Set `cancel-in-progress` according to side effects: normally `true` for CI and
  `false` for deployments unless interruption is demonstrably safe.
- Prefer repository scripts over duplicating application logic in YAML. Keep
  inline shell focused on workflow orchestration and GitHub runner concerns.
- Avoid speculative jobs, services, caches, and platform combinations.

## Expressions, contexts, and data flow

- Verify that every context is available at the key where it is used. Context
  availability differs between workflow, job, step, environment, and
  concurrency fields.
- Use `${{ }}` for GitHub expressions and native YAML booleans or numbers where
  the schema supports them.
- Treat event payload fields, branch names, commit messages, issue and pull
  request text, matrix values, inputs, and action outputs as untrusted data.
- Never interpolate untrusted expressions directly into an inline script. Pass
  them through an intermediate environment variable, quote the shell variable,
  and validate its format before use.
- Write step outputs to `GITHUB_OUTPUT`, environment values to `GITHUB_ENV`, and
  summaries to `GITHUB_STEP_SUMMARY`. Do not use deprecated workflow commands.
- Keep step and job outputs small, non-sensitive, and explicitly named.
- Validate dynamic identifiers such as run IDs, SHAs, artifact names, resource
  names, and paths before using them in commands or API requests.
- Use `fromJSON` only for data produced by a trusted step and validate the
  resulting shape where it affects execution or privileges.
- Use status functions such as `success()`, `failure()`, `cancelled()`, and
  `always()` deliberately. Do not use `always()` for steps that can hang or when
  cancellation should stop side effects.

## Permissions, secrets, and identity

- Declare `permissions` explicitly. Start with `{}` or the narrowest read
  permissions at workflow level, then grant additional permissions only to the
  job that requires them.
- Remember that actions may access `github.token` even when it is not passed as
  an explicit input. Review every action against the job's complete permission
  set.
- Prefer the job-scoped `GITHUB_TOKEN` over personal access tokens. Use a GitHub
  App installation token when required capabilities are unavailable to
  `GITHUB_TOKEN`.
- Never place credentials, tokens, private keys, connection strings, or secret
  values in workflow source, command-line arguments, outputs, artifacts,
  caches, summaries, or logs.
- Store sensitive values as individual GitHub secrets. Store non-sensitive
  configuration as variables. Do not rely on automatic redaction for structured,
  transformed, or generated values.
- Mask sensitive values generated during a job before any command could print
  them. If exposure occurs, remove the affected logs and rotate the credential.
- Prefer OpenID Connect to long-lived cloud credentials. Grant `id-token: write`
  only to the authentication or deployment job that needs it.
- Restrict cloud federation to the repository and intended branch, environment,
  or reusable workflow claims. Keep cloud RBAC least-privileged and narrowly
  scoped.
- Put deployment jobs behind GitHub environments when environment-specific
  variables, secrets, approvals, or protection rules are required.
- Do not expose secrets to workflows executing untrusted fork code.

Follow GitHub's
[secure use reference](https://docs.github.com/en/actions/reference/security/secure-use),
[GITHUB_TOKEN guidance](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token),
and [OpenID Connect guidance](https://docs.github.com/en/actions/concepts/security/openid-connect).

## Actions and supply-chain security

- Pin every `uses:` dependency to a full-length commit SHA, including GitHub and
  third-party actions. Add a release comment such as `# v4.4.0` for
  maintainability.
- Resolve updates from the action's official repository and verify that the SHA
  belongs to the intended release. Never invent or truncate a SHA.
- Prefer GitHub-authored, cloud-provider-authored, or otherwise well-maintained
  actions with minimal permissions and clear release practices.
- Review an action's source and release notes before adding it, especially when
  it receives secrets, tokens, write permissions, artifacts, or access to the
  Docker socket.
- Prefer a short auditable script over an unnecessary action, but do not
  reimplement authentication, artifact transfer, or other security-sensitive
  protocols casually.
- Do not use mutable branch or major-version references such as `@main` or
  `@v4`.
- Keep Dependabot configuration compatible with immutable action pins when
  automated updates are enabled.

## Shell steps

- Set the shell explicitly when behavior depends on it.
- Begin multi-line Bash steps with `set -euo pipefail`.
- Quote variable expansions and use arrays for commands with dynamic argument
  lists.
- Validate untrusted or API-derived values before using them in paths, command
  arguments, environment files, or deployment identifiers.
- Use `mktemp` for temporary files and `trap` to remove them.
- Emit actionable errors with GitHub workflow commands such as
  `::error file=path::message`, without exposing sensitive values.
- Do not suppress a command failure unless the next branch explicitly handles
  the expected failure.
- Avoid `eval`, generated shell programs, and commands assembled from untrusted
  strings.

## Dependencies, caching, and artifacts

- Use the repository's lockfile-based deterministic install command. For this
  Node.js project, preserve `npm ci`.
- Key dependency caches from the relevant lockfile and platform inputs. Treat
  cache contents as untrusted and never cache credentials.
- Use caches only for regenerable dependencies or build inputs. Use artifacts
  for outputs that must cross jobs, workflow runs, or retention boundaries.
- Give artifacts deterministic, unique names and set an intentional retention
  period.
- Set `if-no-files-found: error` when an artifact is required by later work.
- Upload only required files. Never include repository credentials, environment
  files, cloud CLI state, logs containing secrets, or unrelated workspace
  contents.
- When deploying an artifact from another workflow run, bind the deployment to
  a specific repository, workflow, run ID, run attempt, and commit SHA.
- Download the artifact by exact name, verify expected metadata and required
  files, reject expired or ambiguous matches, and fail closed.
- Treat downloaded artifacts as untrusted until their structure and provenance
  have been validated.
- Consider artifact attestations when the threat model requires independently
  verifiable build provenance.

Follow GitHub's
[workflow artifact guidance](https://docs.github.com/en/actions/tutorials/store-and-share-data)
for upload, download, retention, and cross-job behavior.

## Repository CI and deployment invariants

- Preserve the separation between `.github/workflows/ci.yml` and
  `.github/workflows/deploy.yml`.
- CI must validate Bicep formatting, linting, and compilation before packaging
  infrastructure.
- CI must install Node.js dependencies deterministically, type-check, test, and
  build before creating a deployment bundle.
- Only a successful push to `master` may publish the deployable bundle unless
  the user explicitly changes the release policy.
- Build once and deploy the retained CI artifact. Do not rebuild application or
  infrastructure files in the deployment workflow.
- Keep bundle identity tied to repository, workflow, event, ref, commit SHA, run
  ID, and run attempt. Preserve exact metadata verification before deployment.
- Deploy only the latest successful `master` CI run selected by the deployment
  workflow; do not silently fall back to an older artifact when the selected
  artifact is absent, expired, duplicated, or invalid.
- Preserve the deployment environment input, environment protection boundary,
  and per-environment non-cancelling concurrency.
- Authenticate to Azure with OIDC. Keep `id-token: write` limited to the deploy
  job and preserve environment-scoped Azure variables.
- Keep infrastructure deployment before application ZIP deployment and require
  the infrastructure deployment to return a non-empty Function App name.

If a request intentionally changes one of these invariants, update both
workflows and directly related documentation or metadata checks so CI and
deployment continue to agree.

## Validation

Run the narrowest applicable checks in this order:

1. Review the full rendered YAML structure, trigger filters, expressions,
   permissions, job dependencies, and `if` conditions.
2. Search every `uses:` entry and verify full-length immutable SHAs against the
   intended upstream releases.
3. Run an existing workflow linter such as `actionlint` when it is already
   available. Do not add validation tooling solely for a documentation-only
   change.
4. Run or lint scripts called by changed workflow steps using the repository's
   existing commands.
5. For GitHub-hosted validation, inspect the relevant workflow run and job logs.
   Never trigger a deployment or another side-effecting workflow unless the user
   explicitly requests it.

Local YAML parsing cannot prove that GitHub contexts, permissions, events, or
action inputs are valid. Verify those details against current official
documentation and action metadata.

## Review checklist

- Triggers match the intended branches, events, paths, and trust boundary.
- Workflow and job permissions are explicit and least-privileged.
- Untrusted context values cannot become executable shell or privileged action
  input without validation.
- Every action is pinned to a verified full-length commit SHA.
- Secrets and generated credentials cannot enter logs, outputs, caches, or
  artifacts.
- Job dependencies, conditions, timeouts, and concurrency handle failure,
  cancellation, retries, and overlapping runs correctly.
- Dependency installation, tests, builds, caches, and artifacts are
  deterministic.
- Deployment uses a verified artifact from the intended immutable CI run and
  authenticates through narrowly scoped OIDC.
- Validation covers the changed workflow behavior without causing unrequested
  external side effects.
