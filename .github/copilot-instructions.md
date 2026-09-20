# Repository instructions

This repository is currently a scaffold. The implementation directories contain
only `.gitkeep` placeholders; `README.md` documents their intended roles.

## Platform context

- This repository contains one or more Node.js projects intended to be hosted on
  Microsoft Azure.
- Treat Node.js and Azure hosting as fixed project constraints when planning,
  implementing, and reviewing work.
- Do not assume a Node.js version, framework, package manager, module system, or
  Azure hosting service unless repository configuration or an approved plan
  establishes it.
- Prefer Azure-compatible designs and configuration. Keep application code
  portable unless an approved requirement depends on an Azure-specific service.

## Code and infrastructure boundaries

Keep application code in `src/` and unit tests in the singular `test/` directory.
Infrastructure as Code belongs in `deployment/`, which the README designates for
Azure Bicep.

## Repository conventions

- Preserve the `.gitkeep` convention when adding directories that must be tracked
  before they contain implementation files.
- `.gitignore` ignores `.env` and `.env.*`, but explicitly allows `.env.example`
  for configuration examples.
- The Node.js-oriented `.gitignore` covers multiple tools and frameworks; it does
  not establish a Node.js version, framework, package manager, or module system.
  Derive build, test, and lint commands from actual project configuration when
  it is added.
