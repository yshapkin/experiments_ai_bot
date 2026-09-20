---
name: typescript
description: Create, modify, review, and validate TypeScript for this Node.js repository. Use for TypeScript source, tests, types, configuration, module boundaries, async code, error handling, or dependency APIs. Applies official Microsoft TypeScript guidance, strict type safety, Node.js ESM conventions, secure boundary validation, and focused testing.
---

# TypeScript

Use this workflow for every TypeScript planning, implementation, or review task.

## Sources of truth

1. Read the applicable requirements, nearby source and tests, `package.json`,
   TypeScript configuration, and repository instructions.
2. Follow the installed TypeScript and Node.js versions and the repository's
   module system. Do not silently change them.
3. Use the
   [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
   and [TSConfig reference](https://www.typescriptlang.org/tsconfig/) as the
   primary language references.
4. Consult current official documentation for Node.js and third-party APIs before
   relying on version-sensitive behavior.
5. Prefer existing repository patterns when they remain type-safe and satisfy
   the requirements.

If a requirement conflicts with compiler behavior or an installed API, report
the conflict instead of bypassing type checking.

## Compiler and module configuration

- Preserve `strict: true`.
- Preserve `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
  `verbatimModuleSyntax`.
- Preserve the repository's `NodeNext` module and resolution settings.
- Do not weaken compiler options to make code compile.
- Keep test and production build boundaries explicit.
- Use `import type` and `export type` for type-only dependencies.
- Follow Node.js ESM import rules, including emitted file extensions where the
  configured resolver requires them.
- Do not add path aliases unless the runtime, tests, and build all resolve them
  consistently.

## Type design

- Do not use `any` in new code. Use `unknown` at untrusted boundaries and narrow
  it before use.
- Do not use boxed primitive types such as `String`, `Number`, `Boolean`,
  `Symbol`, or `Object`.
- Prefer inference for local implementation details and explicit types for
  public APIs, exported values, callback contracts, and domain boundaries.
- Model alternatives with discriminated unions when states have different data
  or behavior.
- Use literal unions or enums only when they improve domain clarity.
- Use `satisfies` when a value must be checked against a contract without losing
  useful inference.
- Treat indexed access as potentially `undefined`; prove presence rather than
  asserting it.
- Distinguish an absent optional property from a property explicitly containing
  `undefined`.
- Avoid generic parameters that are unused or do not relate input and output
  types.
- Prefer union parameters over overloads that differ only by one parameter type.
- Prefer optional parameters over overloads that differ only by trailing
  parameters when the return type is unchanged.
- Keep general overload signatures after more specific signatures.
- Prefer `readonly` for data that consumers must not mutate.
- Do not introduce branded types, complex conditional types, or generic
  abstractions unless they prevent a demonstrated class of errors.

## Runtime boundaries

Static types do not validate runtime input.

- Validate and narrow environment variables, JSON, HTTP input, Telegram updates,
  configuration, and external-service responses at their entry points.
- Return or throw an explicit error for invalid input; do not use unchecked casts
  or success-shaped defaults.
- Keep transport and framework objects at the boundary. Pass typed domain values
  into core logic.
- Never use `as any`, double assertions, non-null assertions, or
  `@ts-ignore` to suppress an unresolved type problem.
- Use `@ts-expect-error` only for an intentional, tested compiler error and
  include a brief reason.
- Use type assertions only after a runtime invariant has been established but
  cannot be expressed to the compiler.

## Functions and APIs

- Keep functions focused and make side effects explicit.
- Use explicit return types for exported functions and public methods.
- Use `void` for callback return values that callers must ignore.
- Prefer options objects when several parameters are optional or share the same
  primitive type.
- Do not use boolean parameters when a named option or separate function makes
  the behavior clearer.
- Preserve encapsulation; expose the smallest useful API.
- Avoid exporting implementation-only types and values.

## Async code and errors

- Prefer `async` and `await` for readable control flow.
- Await or intentionally return every promise. Do not create floating promises.
- Handle rejected promises at process, request, or job boundaries.
- Use `Promise.all` only for independent operations; preserve ordering where it
  affects correctness or rate limits.
- Support cancellation or timeouts for operations that can block indefinitely
  when the API provides a mechanism.
- Catch `unknown` and narrow it before reading error properties.
- Preserve the original error as `cause` when adding context.
- Do not catch errors only to log and continue unless recovery is defined.
- Never log credentials, tokens, raw user messages, or unnecessary personal
  data.

## Node.js

- Use built-in Node.js APIs before adding a dependency when they provide a clear,
  maintained solution.
- Avoid synchronous filesystem, cryptography, compression, and CPU-intensive
  work on request paths.
- Keep startup configuration validation separate from business logic.
- Do not mutate `process.env`.
- Make process-level startup and shutdown failures explicit.
- Use dependency injection at external boundaries when it improves deterministic
  testing; do not add containers or frameworks solely for injection.

## Testing

- Add or update tests for every behavior change.
- Test public behavior rather than private implementation details.
- Cover success, invalid input, error propagation, and relevant edge cases.
- Use typed fakes at network, clock, filesystem, and framework boundaries.
- Do not call live external services in unit tests.
- Keep tests deterministic and independent of execution order.
- Add compile-time type assertions only when runtime tests cannot verify the
  contract.
- Add a regression test when fixing a bug.

## Dependencies

- Reuse installed dependencies and repository helpers before adding packages.
- Verify that a dependency supports the installed Node.js version, ESM mode, and
  TypeScript version.
- Prefer packages that ship maintained type declarations.
- Do not add a separate `@types` package when the dependency provides its own
  declarations.
- Pin dependency versions according to the repository's existing convention and
  update the lockfile with the package manager.

## Validation

Run the smallest applicable repository commands in this order:

1. Focused tests for changed behavior.
2. `npm run typecheck`.
3. `npm run build` when production source or compiler configuration changes.
4. The full test command when shared behavior or configuration changes.

Do not declare success with type errors, failing tests, unhandled linter findings,
or generated build artifacts unintentionally left in the worktree.

## Review checklist

- The change satisfies the requirement without unrelated refactoring.
- Public and boundary types represent actual runtime behavior.
- Untrusted values are validated before use.
- No compiler protection was weakened or bypassed.
- Async work and failures have an explicit owner.
- Logs exclude secrets and sensitive message content.
- Module imports work under Node.js ESM and `NodeNext`.
- Tests verify behavior and failure paths.
- Type-check, focused tests, and the production build pass when applicable.
