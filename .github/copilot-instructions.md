# Repository instructions

This repository is currently a scaffold. The implementation directories contain
only `.gitkeep` placeholders; `README.md` documents their intended roles.

## Code and infrastructure boundaries

Keep application code in `src/` and unit tests in the singular `test/` directory.
Infrastructure as Code belongs in `deployment/`, which the README designates for
Terraform.

## Repository conventions

- Preserve the `.gitkeep` convention when adding directories that must be tracked
  before they contain implementation files.
- `.gitignore` ignores `.env` and `.env.*`, but explicitly allows `.env.example`
  for configuration examples.
- The Node.js-oriented `.gitignore` covers multiple tools and frameworks; it does
  not establish a chosen runtime, framework, or package manager. Derive build,
  test, and lint commands from actual project configuration when it is added.
