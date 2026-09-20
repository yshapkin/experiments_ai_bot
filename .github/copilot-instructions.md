## Tech stack

- Use **Node.js** and **TypeScript** for projects intended for **Microsoft Azure**; prefer Azure-compatible designs and keep application code portable unless an approved requirement depends on an Azure-specific service.
- Do not assume a framework, package manager, **Node.js** version, module system, or
  Azure service unless the repository configuration establishes it.

## Core engineering principles

- Prefer simple, explicit, maintainable code over clever abstractions.
- Use strict **TypeScript**. Avoid `any` unless there is a clear justification.
- Prefer type-safe interfaces, discriminated unions, branded types, and explicit return types for public APIs.
- Keep functions small and focused.
- Separate business logic from transport, persistence, and framework-specific code.
- Favor dependency injection where it improves testability.
- Preserve existing architecture and conventions unless a change is clearly beneficial.

## Naming conventions

- Use `camelCase` for variables and functions, `PascalCase` for types and classes,
  and descriptive file names consistent with neighboring files.

## Code style

- Use modern **TypeScript** and **Node.js** patterns.
- Prefer `async` / `await` over raw promise chains.
- Always handle async errors intentionally.
- Avoid unhandled promise rejections.
- Avoid blocking the event loop with synchronous filesystem, crypto, compression, or CPU-heavy work in request paths.
- Use `unknown` instead of `any` for untrusted data.

## Error handling

- Use typed application errors where possible.
- Preserve original errors as `cause` when wrapping.
- Log enough context to debug, but never log secrets or sensitive personal data.
- Distinguish operational errors from programmer errors.
- Avoid swallowing errors silently.
- If catching an error only to rethrow it, add meaningful context or remove the catch.

## Testing

- Add or update tests for behavior changes.
- Prefer focused unit tests for business logic.
- Add integration tests for API endpoints, persistence, or external-service boundaries when relevant.
- Test success cases, validation failures, authorization failures, and edge cases.
- Avoid tests that depend on execution order.
- Keep tests deterministic.

## Do not

- Do not commit secrets, generated artifacts, or unrelated changes.
- Do not add dependencies when the platform or standard library already provides
  a clear solution.