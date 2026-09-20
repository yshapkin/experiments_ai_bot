## Plan: Implement Telegram Bot

Create the minimal private-chat Telegram bot specified in `docs/functional-requirements/001-telegram-bot.md`, with typed, isolated grammY handlers, sanitized operational logging, and deterministic mocked-update tests. Production Azure hosting and Bicep remain unchanged because the specification explicitly excludes production hosting, webhooks, and horizontal scaling; implementation must begin on a user-created task branch and end with a reviewed pull-request handoff.

**Tasks**
1. **Task 1: Establish the Node.js and TypeScript project**
   - **Objective:** Add the repository's currently absent application manifest, compiler settings, dependency lockfile, and repeatable scripts after the open tooling decisions are approved.
   - **Files to change:** `package.json`, selected lockfile, `tsconfig.json`
   - **Steps:**
     1. Set the approved Node.js engine, package manager, module system, and package metadata.
     2. Add `typescript`, Node.js typings, grammY, and the approved unit-test tooling.
     3. Enable TypeScript `strict` mode and configure source output under ignored `dist/`.
     4. Define development, build, type-check, test, and start scripts without adding an unrelated application framework.
   - **Acceptance criteria:** The manifest pins the approved runtime/tooling; dependency installation is reproducible from one lockfile; strict compilation covers `src` and tests as appropriate; build, type-check, test, and start scripts are documented and resolve to real tools.

2. **Task 2: Add secure runtime configuration and sanitized logging**
   - **Objective:** Load the Telegram credential safely and expose logging primitives that never disclose the token or user message bodies.
   - **Files to change:** `.env.example`, `src/config.ts`, `src/logger.ts`, corresponding tests under `test/`
   - **Steps:**
     1. Read `TELEGRAM_BOT_TOKEN` from the process environment without hard-coding or committing a credential.
     2. Validate the value at startup and throw a clear, token-free error when it is missing or blank.
     3. Implement startup and processing-failure logging with controlled metadata only (for example event name, update ID, and safe error classification), excluding update payloads, message text, and secrets.
     4. Document the variable using a placeholder in `.env.example`.
   - **Acceptance criteria:** Missing/blank configuration fails before polling with a clear message; no real credential is stored; tests prove logged failure data contains neither a supplied token nor supplied message text.

3. **Task 3: Compose the bot and register isolated handlers**
   - **Objective:** Create a typed grammY bot factory that registers separate command, callback-query, and message modules and a thin executable entry point for long polling.
   - **Files to change:** `src/bot.ts`, `src/index.ts`, `src/handlers/start.ts`, `src/handlers/help.ts`, `src/handlers/text.ts`
   - **Steps:**
     1. Export a bot factory suitable for dependency-isolated tests.
     2. Export typed registration functions from each handler module and register them once on the main `Bot` instance.
     3. Restrict supported behavior to private chats and attach a bot-level processing error handler using sanitized logging.
     4. Start long polling only from the executable entry point and log successful startup without the token.
   - **Acceptance criteria:** Importing the bot factory does not start network polling; all handlers are separately typed and registered; no handler/context extension uses `any`; group, channel, media, and edited-message updates do not trigger supported responses; startup and processing failures use sanitized logs.

4. **Task 4: Implement the `/start` interaction**
   - **Objective:** Send exactly one welcome response with the required inline Help action.
   - **Files to change:** `src/handlers/start.ts`, `test/start.test.ts`
   - **Steps:**
     1. Register the `start` command for private chats.
     2. Reply once with text that welcomes the user and asks them to send text.
     3. Attach an inline keyboard containing a visible `Help` button whose callback data is exactly `help`.
   - **Acceptance criteria:** A mocked private `/start` update produces exactly one `sendMessage` request; its text communicates the required guidance; its inline keyboard contains `Help` with callback data `help`.

5. **Task 5: Implement the Help callback**
   - **Objective:** Acknowledge the Help callback and explain echo behavior in the originating private chat.
   - **Files to change:** `src/handlers/help.ts`, `test/help.test.ts`
   - **Steps:**
     1. Register a handler for callback data exactly equal to `help`.
     2. Acknowledge the callback query so Telegram can stop its loading indicator.
     3. Send a message to the same chat explaining that plain-text messages are echoed.
   - **Acceptance criteria:** A mocked `help` callback produces one callback-answer API request and one message to the originating chat; the help text describes plain-text echoing; unrelated callbacks do not trigger this flow.

6. **Task 6: Implement non-command text echoing**
   - **Objective:** Echo supported private-chat plain text exactly while preventing commands from entering the echo path.
   - **Files to change:** `src/handlers/text.ts`, `test/text.test.ts`
   - **Steps:**
     1. Filter private-chat text messages so command text is excluded.
     2. Reply with the received text unchanged.
     3. Leave media, edited messages, and non-private updates unhandled.
   - **Acceptance criteria:** A mocked private `Hello` update produces exactly one reply with `Hello`; `/start` produces only the start response and no echo; other command text is not echoed; unsupported update/chat types produce no bot response.

7. **Task 7: Build deterministic, network-free verification**
   - **Objective:** Cover every specification acceptance criterion and key security/boundary behavior without contacting Telegram.
   - **Files to change:** `test/helpers/telegram.ts`, `test/config.test.ts`, `test/logging.test.ts`, `test/start.test.ts`, `test/help.test.ts`, `test/text.test.ts`, test configuration if required by the approved runner
   - **Steps:**
     1. Build fixed Telegram update factories with stable IDs, timestamps, users, and private chats.
     2. Intercept grammY API calls at its API client boundary and return typed fake Telegram results; prohibit real HTTP.
     3. Assert API method, payload, call count, ordering where relevant, same-chat behavior, and exclusions.
     4. Run strict type-check, unit tests, and production build using the scripts established in Task 1.
   - **Acceptance criteria:** Tests deterministically cover every functional acceptance criterion plus missing configuration, log confidentiality, private-chat scope, unsupported updates, and network prohibition; the approved type-check, test, and build commands all pass.

8. **Task 8: Document operation and prepare reviewed PR handoff**
   - **Objective:** Make local usage reproducible and provide the user with a reviewable branch/PR outcome without expanding into production deployment.
   - **Files to change:** `README.md`; no files under `deployment/`
   - **Steps:**
     1. Document prerequisites, dependency installation, placeholder environment setup, local long-polling startup, validation scripts, supported behavior, and limitations.
     2. Confirm no token, `.env` file, generated output, or user-message fixture containing sensitive data is included in the diff.
     3. Review the implementation against this plan and the functional specification.
     4. After approval, provide the proposed commit message and PR title/body (summary, validation, configuration, and explicit Azure/production exclusions) for the user to commit, push, and open from the separate task branch.
   - **Acceptance criteria:** A new contributor can configure and run the bot from the README; `deployment/` remains unchanged; review has no unresolved critical/major findings; the handoff includes a commit message and PR description that links the specification and reports successful validation. Branch creation, commit, push, and PR creation are performed by the user or an authorized coordinator because specialized agents may not commit and this planning run may not switch branches.

**Open Questions**
1. Which Node.js version should be the project baseline? Options: **Node.js 22 LTS** or another explicitly approved supported version. No runtime pin exists in the repository.
2. Which package manager and lockfile should be authoritative? Options: **npm/package-lock.json**, **pnpm/pnpm-lock.yaml**, or **Yarn/yarn.lock**. The repository currently establishes none.
3. Which module system should TypeScript target? Options: **ES modules (`"type": "module"`)** or **CommonJS**. The repository and specification do not decide this.
4. Which unit-test runner should implement the mocked Telegram-update suite? Options: **Vitest**, **Node's built-in test runner**, or another approved runner. No test tooling or established validation commands exist.
5. Before implementation, can the user create/switch to a separate branch (suggested `feat/telegram-bot`) and later perform the manual commit/push/PR steps? This planning run is prohibited from switching branches, while the original request requires separate-branch delivery and a PR.
6. Azure hosting is explicitly out of scope for this version. Confirm that `deployment/` should remain untouched and that Azure service selection, webhook ingress, scaling, and production observability will be handled by a future specification.

## Ledger

### Entry 1: Original request

- **Actor:** User
- **Decision or result:** "need to implement and this spec --file docs/functional-requirements/001-telegram-bot.md. need to do it in the separate barnch after all work will be done neeed to create the PR"
- **Task progress:** 0 of 8 tasks implemented
- **Next action:** Planner researches the specification and repository and records an implementation plan.

### Entry 2: Planning result

- **Actor:** Planner
- **Decision or result:** Researched the orchestration contract, Telegram bot specification, repository layout, README, and ignore rules. Produced an eight-task plan covering strict Node.js/TypeScript setup, grammY composition and isolated handlers, credential safety, sanitized observability, every functional criterion, deterministic no-network tests, explicit Azure deployment exclusion, documentation, branch workflow, review, and PR handoff. No source, configuration, branch, test, build, or implementation action was performed. Required runtime, package-manager, module-system, test-runner, branch, and Azure-scope decisions remain open; no validation commands are established until Task 1 tooling is approved.
- **Task progress:** 0 of 8 tasks implemented
- **Next action:** Commandeer must present the plan and questions, obtain the user's decisions, then wait for the user to choose plan review or implementation.

### Entry 3: Implementation decision

- **Actor:** User
- **Decision or result:** "Implement the plan:

  1. Establish strict TypeScript tooling, dependency locking, and build/test scripts.
  2. Validate `TELEGRAM_BOT_TOKEN` and add logging that excludes credentials and message content.
  3. Create a testable grammY bot with separate handlers and local long polling.
  4. Implement `/start`: one welcome message with a **Help** button.
  5. Implement the Help callback: acknowledge it and explain echo behavior.
  6. Echo private-chat, non-command text unchanged; ignore unsupported updates.
  7. Add deterministic, network-free tests for responses, configuration, filtering, and logging; verify compilation and build.
  8. Document local operation, review changes, and create the requested PR after implementation. Production Azure deployment remains outside this specification.

  **Decisions needed:** The repository does not establish runtime or tooling. Approve **Node.js 22, npm, ES modules, and Node’s built-in test runner**, or specify alternatives.

  **Current stage:** Planning  
  **Task progress:** 0 of 8 tasks implemented  
  **Last action:** Planner recorded the implementation plan and unresolved tooling decisions.  
  **Next action:** Confirm tooling and choose **implement** or **review the plan**."
- **Task progress:** 0 of 8 tasks implemented
- **Next action:** Developer implements the explicitly approved plan using Node.js 22, npm, ES modules, and Node's built-in test runner on the runtime-provided task branch; production Azure deployment remains excluded.

### Entry 4: Implementation result

- **Actor:** Developer
- **Decision or result:** Received the user's implementation decision exactly as recorded in Entry 3, including approval of Node.js 22, npm, ES modules, Node's built-in test runner, the runtime-provided task branch, and exclusion of production Azure deployment. Completed Tasks 1-8 without changing their scope or numbering: scaffolded a strict TypeScript npm project with exact dependency versions and a lockfile; added token validation and structured sanitized logging; composed an import-safe grammY bot factory with isolated start, help, and text handlers plus a long-polling executable; implemented the required private-chat responses and unsupported-update filtering; added deterministic API-transformer tests that never call Telegram; and documented local setup, operation, validation, supported behavior, and production limitations. No files under `deployment/` changed. The repository has no pull-request template outside the explicitly excluded `.github/agents` path, so no template fields apply. The available tool set does not provide `parallel_validation`, so the requested nontrivial CodeQL declaration could not be invoked. Proposed commit message: `feat: implement private Telegram echo bot`. Proposed PR title: `Implement private Telegram echo bot`. Proposed PR body: `## Summary\n- implement the grammY /start, Help callback, and private plain-text echo flows\n- add validated token configuration and sanitized operational logging\n- add deterministic network-free tests and local-operation documentation\n\n## Validation\n- npm run typecheck\n- npm test (10 tests passed)\n- npm run build\n- npm audit --omit=dev (0 vulnerabilities)\n\n## Configuration\nSet TELEGRAM_BOT_TOKEN locally as documented in README.md. No credential is committed.\n\n## Scope\nImplements docs/functional-requirements/001-telegram-bot.md. Azure production hosting, infrastructure, webhooks, and horizontal scaling remain excluded.`
- **Files changed:** `.env.example`; `package.json`; `package-lock.json`; `tsconfig.json`; `tsconfig.build.json`; `src/bot.ts`; `src/config.ts`; `src/index.ts`; `src/logger.ts`; `src/handlers/start.ts`; `src/handlers/help.ts`; `src/handlers/text.ts`; `test/helpers/telegram.ts`; `test/config.test.ts`; `test/logging.test.ts`; `test/start.test.ts`; `test/help.test.ts`; `test/text.test.ts`; `README.md`; deleted placeholder files `src/.gitkeep` and `test/.gitkeep`; appended this workflow ledger.
- **Validation commands and exact outcomes:** `npm run typecheck && npm test && npm run build` exited 0: strict type-check passed, all 10 tests across 5 suites passed with 0 failures, and the production build passed. `env -u TELEGRAM_BOT_TOKEN npm start` exited 1 as expected before polling with `TELEGRAM_BOT_TOKEN must be set to a non-blank value`. `npm audit --omit=dev` exited 0 with `found 0 vulnerabilities`. The changed-file security scan for dangerous execution APIs, private-key/AWS-key signatures, and embedded Telegram API bot-token URLs exited 0 with no matches. `git diff --name-only -- deployment` and the final deployment numstat produced no output. The PR-template search produced no output. `git diff --check` reported only the intentional Markdown hard-break whitespace preserved in the exact user decision in Entry 3. During implementation, the first type-check found newly required grammY bot-info fixture fields and the first test run found an assertion comparing an `InlineKeyboard` instance to a plain object; both test-only issues were corrected before the final successful validation.
- **Blockers, failures, or remaining tasks:** No implementation blocker or unresolved implementation failure. All eight tasks are implemented. Independent code review, final completion ledger entry after approval, coordinator progress commit, and PR creation remain workflow actions outside the Developer's authority.
- **Task progress:** 8 of 8 tasks implemented
- **Next action:** Commandeer invokes the Reviewer for independent code review; after approval, Commandeer returns to the Developer for the required final completion entry, then performs the coordinator-managed commit and PR workflow.

## Review: Code Changes for Implement Telegram Bot

**Status:** APPROVED

**Summary:** Reviewed committed implementation `c7c6d32` against parent `4770728`, the approved plan, and `docs/functional-requirements/001-telegram-bot.md`. The implementation satisfies all eight tasks and the specified private-chat behavior without expanding into excluded Azure production hosting.

**User decision received:** Independently review the completed committed code changes against the approved plan and specification; inspect the implementation commit against its parent, verify branch separation, secrets, Node.js/Azure constraints, and validation evidence, and do not run tests, builds, or linters during this review.

**Strengths:** Strict Node.js 22/npm/ES-module configuration and a committed npm lockfile match the approved decisions. `loadConfig` rejects missing or blank credentials before polling; `.env` remains ignored and only a placeholder is tracked. The grammY factory is import-safe, uses typed isolated handlers, scopes supported behavior to private chats, and logs only controlled startup and processing-failure metadata. Mocked API-transformer tests cover start, Help acknowledgement/same-chat reply, exact echoing, command exclusion, and unsupported update types without Telegram HTTP. README documents local long polling and explicitly preserves the approved Azure, webhook, infrastructure, and scaling exclusions. `deployment/` has no implementation-commit changes. The reviewed branch is `copilot/implement-telegram-bot`, tracks `origin/copilot/implement-telegram-bot`, and is distinct from the remote default branch `master` (verified with read-only `git ls-remote --symref origin HEAD`). No real credential-like tracked file was found beyond `.env.example`.

**Issues:** None.

**Recommendations:** Retain the documented Node.js 22 constraint for the deployment target selected by any future Azure-hosting work. Reviewer did not run validation commands, as directed; the recorded developer evidence reports successful `npm run typecheck`, `npm test`, and `npm run build`. `parallel_validation`/CodeQL was unavailable in this review environment, so no CodeQL scan was run or claimed.

**Task progress:** 8 of 8 tasks implemented

**Next Steps:** Proceed to the Developer for the required final completion ledger entry, then have the authorized coordinator perform the runtime-managed commit/PR handoff; do not stop for rework approval.

### Entry 5: Final completion

- **Actor:** Developer
- **Received user decision:** Read the approved review and append the final completion record with the accomplishment summary, changed files, final review status, validation evidence and limitations, and proposed commit message. All eight tasks are implemented and independently approved; do not modify source or run tests, builds, or linters. Retain the Node.js/Azure scope. The runtime coordinator will commit the ledger and open the requested PR, so no manual-user commit blocker remains.
- **Accomplishment summary:** Completed Tasks 1-8 under the approved Node.js 22, npm, ES-module, and Node built-in test-runner choices: established the strict TypeScript project; added secure token configuration and sanitized logging; implemented the typed, import-safe grammY bot with isolated private-chat `/start`, Help callback, and non-command text handlers; added deterministic network-free verification; and documented local operation and production exclusions. Azure hosting, Bicep, webhooks, and horizontal scaling remain unchanged and out of scope.
- **Files changed:** `.env.example`; `package.json`; `package-lock.json`; `tsconfig.json`; `tsconfig.build.json`; `src/bot.ts`; `src/config.ts`; `src/index.ts`; `src/logger.ts`; `src/handlers/start.ts`; `src/handlers/help.ts`; `src/handlers/text.ts`; `test/helpers/telegram.ts`; `test/config.test.ts`; `test/logging.test.ts`; `test/start.test.ts`; `test/help.test.ts`; `test/text.test.ts`; `README.md`; deleted placeholders `src/.gitkeep` and `test/.gitkeep`; this workflow ledger. No files under `deployment/` changed.
- **Final review status:** APPROVED with no issues. The independent Reviewer verified implementation commit `c7c6d32` against parent `4770728`, the approved plan, and the functional specification, including branch separation, secret handling, Node.js constraints, and unchanged Azure deployment scope.
- **Validation summary and limitations:** Developer evidence recorded `npm run typecheck && npm test && npm run build` exiting 0, with strict type-check and production build passing and all 10 tests across 5 suites passing with 0 failures; missing-token startup failed safely as expected; `npm audit --omit=dev` reported 0 vulnerabilities; security, deployment-change, and PR-template checks found no concerns. The Reviewer did not rerun tests, builds, or linters as directed. `parallel_validation`/CodeQL was unavailable, so no CodeQL result is claimed. No validation command was run while appending this completion record.
- **Proposed commit message:** `feat: implement private Telegram echo bot`
- **Task progress:** 8 of 8 tasks implemented and independently approved
- **Next action:** The authorized runtime coordinator commits this ledger update and opens the requested pull request using the recorded PR title/body; no source rework or manual-user commit handoff is required.
