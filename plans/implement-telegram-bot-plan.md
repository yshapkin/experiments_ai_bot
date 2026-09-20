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
