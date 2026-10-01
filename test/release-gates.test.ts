import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const ciWorkflowPath = resolve(repositoryRoot, ".github/workflows/ci.yml");
const deployWorkflowPath = resolve(
  repositoryRoot,
  ".github/workflows/deploy.yml",
);
const telegramBridgeUrl = "https://telegram.org/js/telegram-web-app.js";

const temporaryRoots: string[] = [];

after(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { force: true, recursive: true });
  }
});

function createTemporaryRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "experiments-ai-bot-gates-"));
  temporaryRoots.push(root);
  return root;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function indentationOf(line: string): number {
  const match = /^ */u.exec(line);
  return match === null ? 0 : match[0].length;
}

/**
 * Returns the verbatim shell script of a workflow step, identified by its
 * step-list `- name:` entry. The workflow files are the single home of the
 * release-gate logic, so the tests execute that exact text instead of
 * re-implementing it.
 */
function extractStepScript(workflowPath: string, stepName: string): string {
  const lines = readFileSync(workflowPath, "utf8").split("\n");
  const stepPattern = new RegExp(
    `^( *)- name: ${escapeForRegExp(stepName)} *$`,
    "u",
  );

  const matchIndexes: number[] = [];
  for (const [index, line] of lines.entries()) {
    if (stepPattern.test(line)) {
      matchIndexes.push(index);
    }
  }
  assert.equal(
    matchIndexes.length,
    1,
    `Expected exactly one step entry named '${stepName}' in ${workflowPath}, found ${matchIndexes.length}.`,
  );

  const startIndex = matchIndexes[0] ?? -1;
  const stepIndent = indentationOf(lines[startIndex] ?? "");
  const keyIndent = stepIndent + 2;
  const runPattern = new RegExp(`^ {${keyIndent}}run: *(.*)$`, "u");

  let runIndex = -1;
  let runValue = "";
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      continue;
    }
    if (indentationOf(line) <= stepIndent) {
      break;
    }
    const runMatch = runPattern.exec(line);
    if (runMatch !== null) {
      runIndex = index;
      runValue = (runMatch[1] ?? "").trim();
      break;
    }
  }

  assert.notEqual(
    runIndex,
    -1,
    `Step '${stepName}' in ${workflowPath} has no 'run:' key.`,
  );
  assert.ok(
    runValue === "|" || runValue === "|-",
    `Step '${stepName}' in ${workflowPath} must keep its script in a literal block scalar ('run: |' or 'run: |-'), found 'run: ${runValue}'.`,
  );

  const scriptLines: string[] = [];
  let blockIndent = -1;
  for (let index = runIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      scriptLines.push("");
      continue;
    }
    const indent = indentationOf(line);
    if (indent <= keyIndent) {
      break;
    }
    if (blockIndent === -1) {
      blockIndent = indent;
    }
    scriptLines.push(line.slice(blockIndent));
  }

  assert.ok(
    scriptLines.some((line) => line.trim() !== ""),
    `Step '${stepName}' in ${workflowPath} has an empty script block.`,
  );

  return `${scriptLines.join("\n")}\n`;
}

interface ScriptResult {
  readonly status: number;
  readonly output: string;
}

function runScript(
  script: string,
  options: { cwd: string; env: Record<string, string> },
): ScriptResult {
  const scriptDirectory = createTemporaryRoot();
  const scriptPath = resolve(scriptDirectory, "gate.sh");
  writeFileSync(scriptPath, script, "utf8");

  const result = spawnSync("bash", [scriptPath], {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });

  return {
    status: result.status ?? -1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function writeFixtureFile(
  root: string,
  relativePath: string,
  contents: string,
): void {
  const filePath = resolve(root, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
}

function entryHtml(references: readonly string[]): string {
  const tags = references
    .map((reference) => `    <link href="${reference}" />`)
    .join("\n");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    `    <script type="module" src="${telegramBridgeUrl}"></script>`,
    "    <title>Telegram Mini App — Hello World</title>",
    tags,
    "  </head>",
    "  <body><h1>Hello World</h1></body>",
    "</html>",
    "",
  ].join("\n");
}

function createValidPayload(root: string, payloadPath: string): void {
  writeFixtureFile(
    root,
    `${payloadPath}/index.html`,
    entryHtml(["./assets/app.css", "/assets/hello%20world.js"]),
  );
  writeFixtureFile(root, `${payloadPath}/assets/app.css`, "body{margin:0}\n");
  writeFixtureFile(
    root,
    `${payloadPath}/assets/hello world.js`,
    "console.log('hello');\n",
  );
}

const validateMiniAppScript = extractStepScript(
  ciWorkflowPath,
  "Validate Mini App static output",
);
const writeBundleMetadataScript = extractStepScript(
  ciWorkflowPath,
  "Write bundle metadata",
);
const verifyBundleFilesScript = extractStepScript(
  deployWorkflowPath,
  "Verify bundle files",
);
const verifyBundleProvenanceScript = extractStepScript(
  deployWorkflowPath,
  "Verify bundle provenance",
);
const verifyPublishedEndpointScript = extractStepScript(
  deployWorkflowPath,
  "Verify published Mini App endpoint",
);

const expectedRepository = "octo-org/experiments-ai-bot";
const expectedCommitSha = "0123456789abcdef0123456789abcdef01234567";
const expectedRunId = "1234567890";
const expectedRunAttempt = "2";

function bundleMetadata(bundleVersion: number): string {
  return `${JSON.stringify(
    {
      bundleVersion,
      repository: expectedRepository,
      workflow: "ci.yml",
      event: "push",
      ref: "refs/heads/master",
      commitSha: expectedCommitSha,
      runId: expectedRunId,
      runAttempt: expectedRunAttempt,
    },
    null,
    2,
  )}\n`;
}

function createDeployBundle(
  root: string,
  options: { bundleVersion?: number; miniAppIndex?: string } = {},
): void {
  const bundleVersion = options.bundleVersion ?? 2;
  writeFixtureFile(root, "bundle/function-app.zip", "not-a-real-zip\n");
  writeFixtureFile(
    root,
    "bundle/infrastructure/main.json",
    '{"contentVersion":"1.0.0.0"}\n',
  );
  writeFixtureFile(
    root,
    "bundle/infrastructure/main.parameters.json",
    '{"contentVersion":"1.0.0.0"}\n',
  );
  writeFixtureFile(root, "bundle/metadata.json", bundleMetadata(bundleVersion));
  if (options.miniAppIndex === undefined) {
    createValidPayload(root, "bundle/mini-app");
  } else {
    writeFixtureFile(root, "bundle/mini-app/index.html", options.miniAppIndex);
  }
}

function runPublishedEndpoint(
  root: string,
  entryResponse: "matching" | "stale" | "stale-once",
  assetResponse: "matching" | "stale" = "matching",
  configResponse: "matching" | "missing" | "html" | "stale" | "malformed" | "wrong-schema" | "different" = "matching",
  generatedConfig = '{"functionBaseUrl":"https://func.azurewebsites.net"}\n',
): ScriptResult {
  createDeployBundle(root);
  writeFixtureFile(
    root,
    "bundle/mini-app/index.html",
    '<!doctype html><title>Telegram User Profile</title><main id="app"></main>\n',
  );
  writeFixtureFile(root, "stale-index.html", "<h1>Old release</h1>\n");
  writeFixtureFile(root, "stale-asset.css", "body{color:red}\n");
  writeFixtureFile(root, "bundle/runtime/config.json", generatedConfig);
  writeFixtureFile(root, "stale-config.json", '{"functionBaseUrl":"https://other.azurewebsites.net"}\n');
  writeFixtureFile(root, "malformed-config.json", "{invalid json\n");
  writeFixtureFile(root, "wrong-schema.json", '{"functionBaseUrl":"https://func.azurewebsites.net","token":"not-allowed"}\n');
  writeFixtureFile(root, "different-config.json", '{ "functionBaseUrl": "https://func.azurewebsites.net" }\n');

  const bin = resolve(root, "bin");
  writeFixtureFile(root, "bin/curl", [
    "#!/usr/bin/env bash",
    'while [[ "$#" -gt 1 ]]; do',
    '  if [[ "$1" == "--output" ]]; then output="$2"; shift 2; else shift; fi',
    "done",
    'if [[ "$1" == */config.json ]]; then',
    '  case "$MOCK_CONFIG_RESPONSE" in',
    '    missing) printf "404"; exit 0;;',
    '    html) cp "$MOCK_BUNDLE_ENTRY" "$output";;',
    '    stale) cp "$MOCK_STALE_CONFIG" "$output";;',
    '    malformed) cp "$MOCK_MALFORMED_CONFIG" "$output";;',
    '    wrong-schema) cp "$MOCK_WRONG_SCHEMA_CONFIG" "$output";;',
    '    different) cp "$MOCK_DIFFERENT_CONFIG" "$output";;',
    '    *) cp "$MOCK_BUNDLE_CONFIG" "$output";;',
    '  esac',
    'elif [[ "$1" == */assets/* ]]; then',
    '  if [[ "$MOCK_ASSET_RESPONSE" == "stale" ]]; then',
    '    cp "$MOCK_STALE_ASSET" "$output"',
    "  else",
    '    cp "$MOCK_BUNDLE_ASSET" "$output"',
    "  fi",
    "else",
    '  count="$(cat "$MOCK_COUNT")"',
    '  echo "$((count + 1))" > "$MOCK_COUNT"',
    '  if [[ "$MOCK_ENTRY_RESPONSE" == "stale" ]] ||',
    '    [[ "$MOCK_ENTRY_RESPONSE" == "stale-once" && "$count" == "0" ]]; then',
    '    cp "$MOCK_STALE_ENTRY" "$output"',
    "  else",
    '    cp "$MOCK_BUNDLE_ENTRY" "$output"',
    "  fi",
    "fi",
    "printf '200'",
    "",
  ].join("\n"));
  writeFixtureFile(root, "bin/sleep", "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(resolve(bin, "curl"), 0o755);
  chmodSync(resolve(bin, "sleep"), 0o755);
  writeFixtureFile(root, "request-count", "0\n");
  writeFixtureFile(root, "summary", "");

  return runScript(verifyPublishedEndpointScript, {
    cwd: root,
    env: {
      BUNDLE_DIR: "bundle",
      STATIC_WEB_APP_BASE_URL: "https://site.example",
      STATIC_WEB_APP_NAME: "mini-app",
      FUNCTION_APP_BASE_URL: "https://func.azurewebsites.net",
      PINNED_RUN_ID: expectedRunId,
      PINNED_RUN_ATTEMPT: expectedRunAttempt,
      PINNED_HEAD_SHA: expectedCommitSha,
      GITHUB_STEP_SUMMARY: resolve(root, "summary"),
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      MOCK_ENTRY_RESPONSE: entryResponse,
      MOCK_ASSET_RESPONSE: assetResponse,
      MOCK_CONFIG_RESPONSE: configResponse,
      MOCK_BUNDLE_CONFIG: resolve(root, "bundle/runtime/config.json"),
      MOCK_STALE_CONFIG: resolve(root, "stale-config.json"),
      MOCK_MALFORMED_CONFIG: resolve(root, "malformed-config.json"),
      MOCK_WRONG_SCHEMA_CONFIG: resolve(root, "wrong-schema.json"),
      MOCK_DIFFERENT_CONFIG: resolve(root, "different-config.json"),
      MOCK_BUNDLE_ENTRY: resolve(root, "bundle/mini-app/index.html"),
      MOCK_BUNDLE_ASSET: resolve(root, "bundle/mini-app/assets/app.css"),
      MOCK_STALE_ENTRY: resolve(root, "stale-index.html"),
      MOCK_STALE_ASSET: resolve(root, "stale-asset.css"),
      MOCK_COUNT: resolve(root, "request-count"),
    },
  });
}

describe("release gate scripts", () => {
  it("runs the extracted scripts under the local bash", (t) => {
    const version = spawnSync("bash", ["-c", 'echo "${BASH_VERSINFO[0]}"'], {
      encoding: "utf8",
    });
    t.diagnostic(`bash major version: ${(version.stdout ?? "").trim()}`);
    assert.equal(version.status, 0);
  });

  describe("ci.yml 'Validate Mini App static output' (source root)", () => {
    it("accepts a coherent payload with local assets and the Telegram bridge", () => {
      const root = createTemporaryRoot();
      createValidPayload(root, "dist");

      const result = runScript(validateMiniAppScript, {
        cwd: root,
        env: { MINI_APP_DIST: "dist" },
      });

      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /Validated Mini App payload root 'dist'/u);
    });

    it("rejects a local reference that escapes the payload directory", () => {
      const root = createTemporaryRoot();
      createValidPayload(root, "dist");
      writeFixtureFile(root, "dist/index.html", entryHtml(["../outside.css"]));
      writeFixtureFile(root, "outside.css", "body{}\n");

      const result = runScript(validateMiniAppScript, {
        cwd: root,
        env: { MINI_APP_DIST: "dist" },
      });

      assert.equal(result.status, 1);
      assert.match(result.output, /escapes the payload directory/u);
    });

    it("rejects an empty referenced local asset", () => {
      const root = createTemporaryRoot();
      createValidPayload(root, "dist");
      writeFixtureFile(root, "dist/assets/app.css", "");

      const result = runScript(validateMiniAppScript, {
        cwd: root,
        env: { MINI_APP_DIST: "dist" },
      });

      assert.equal(result.status, 1);
      assert.match(
        result.output,
        /references missing or empty local asset '\.\/assets\/app\.css'/u,
      );
    });

    it("rejects a missing referenced local asset", () => {
      const root = createTemporaryRoot();
      createValidPayload(root, "dist");
      rmSync(resolve(root, "dist/assets/hello world.js"));

      const result = runScript(validateMiniAppScript, {
        cwd: root,
        env: { MINI_APP_DIST: "dist" },
      });

      assert.equal(result.status, 1);
      assert.match(
        result.output,
        /references missing or empty local asset '\/assets\/hello%20world\.js'/u,
      );
    });

    it("rejects a symbolic link inside the payload tree", () => {
      const root = createTemporaryRoot();
      createValidPayload(root, "dist");
      writeFixtureFile(root, "dist/assets/real.css", "body{}\n");
      rmSync(resolve(root, "dist/assets/app.css"));
      symlinkSync("real.css", resolve(root, "dist/assets/app.css"));

      const result = runScript(validateMiniAppScript, {
        cwd: root,
        env: { MINI_APP_DIST: "dist" },
      });

      assert.equal(result.status, 1);
      assert.match(result.output, /contains symbolic link/u);
    });

    it("rejects an empty reference attribute value", () => {
      const root = createTemporaryRoot();
      createValidPayload(root, "dist");
      writeFixtureFile(
        root,
        "dist/index.html",
        entryHtml(["./assets/app.css", ""]),
      );

      const result = runScript(validateMiniAppScript, {
        cwd: root,
        env: { MINI_APP_DIST: "dist" },
      });

      assert.equal(result.status, 1);
      assert.match(result.output, /has an empty local reference ''/u);
    });

    it("rejects a payload without a non-empty index.html", () => {
      const root = createTemporaryRoot();
      writeFixtureFile(root, "dist/index.html", "");

      const result = runScript(validateMiniAppScript, {
        cwd: root,
        env: { MINI_APP_DIST: "dist" },
      });

      assert.equal(result.status, 1);
      assert.match(result.output, /has no non-empty index\.html file/u);
    });
  });

  describe("ci.yml 'Validate Mini App static output' (copied bundle tree)", () => {
    it("accepts a complete and coherent copied payload", () => {
      const root = createTemporaryRoot();
      createValidPayload(root, "dist");
      createValidPayload(root, "bundle/mini-app");

      const result = runScript(validateMiniAppScript, {
        cwd: root,
        env: { MINI_APP_DIST: "dist", BUNDLE_MINI_APP_DIST: "bundle" },
      });

      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /Validated Mini App payload root 'dist'/u);
      assert.match(
        result.output,
        /Validated Mini App payload root 'bundle\/mini-app'/u,
      );
    });

    it("rejects a partial copy whose referenced asset is missing", () => {
      const root = createTemporaryRoot();
      createValidPayload(root, "dist");
      createValidPayload(root, "bundle/mini-app");
      rmSync(resolve(root, "bundle/mini-app/assets"), {
        force: true,
        recursive: true,
      });

      const result = runScript(validateMiniAppScript, {
        cwd: root,
        env: { MINI_APP_DIST: "dist", BUNDLE_MINI_APP_DIST: "bundle" },
      });

      assert.equal(result.status, 1);
      assert.match(
        result.output,
        /Mini App payload root 'bundle\/mini-app' references missing or empty local asset/u,
      );
    });

    it("rejects a mis-rooted copy that nests the built directory", () => {
      const root = createTemporaryRoot();
      createValidPayload(root, "dist");
      createValidPayload(root, "bundle/mini-app/dist");

      const result = runScript(validateMiniAppScript, {
        cwd: root,
        env: { MINI_APP_DIST: "dist", BUNDLE_MINI_APP_DIST: "bundle" },
      });

      assert.equal(result.status, 1);
      assert.match(
        result.output,
        /Mini App payload root 'bundle\/mini-app' has no non-empty index\.html file/u,
      );
    });
  });

  describe("deploy.yml bundle gate", () => {
    const provenanceEnvironment = {
      BUNDLE_DIR: "bundle",
      GITHUB_REPOSITORY: expectedRepository,
      EXPECTED_HEAD_SHA: expectedCommitSha,
      EXPECTED_RUN_ID: expectedRunId,
      EXPECTED_RUN_ATTEMPT: expectedRunAttempt,
    };

    it("accepts a structurally sound schema-v2 bundle", () => {
      const root = createTemporaryRoot();
      createDeployBundle(root);

      const filesResult = runScript(verifyBundleFilesScript, {
        cwd: root,
        env: { BUNDLE_DIR: "bundle" },
      });
      const provenanceResult = runScript(verifyBundleProvenanceScript, {
        cwd: root,
        env: provenanceEnvironment,
      });

      assert.equal(filesResult.status, 0, filesResult.output);
      assert.equal(provenanceResult.status, 0, provenanceResult.output);
    });

    it("rejects a schema-v1 bundle in the provenance step", () => {
      const root = createTemporaryRoot();
      createDeployBundle(root, { bundleVersion: 1 });

      const result = runScript(verifyBundleProvenanceScript, {
        cwd: root,
        env: provenanceEnvironment,
      });

      assert.equal(result.status, 1);
      assert.match(
        result.output,
        /Schema version 1 bundles are no longer deployable/u,
      );
    });

    it("rejects a bundle without mini-app/index.html", () => {
      const root = createTemporaryRoot();
      createDeployBundle(root);
      rmSync(resolve(root, "bundle/mini-app/index.html"));

      const result = runScript(verifyBundleFilesScript, {
        cwd: root,
        env: { BUNDLE_DIR: "bundle" },
      });

      assert.equal(result.status, 1);
      assert.match(
        result.output,
        /missing required non-empty file 'bundle\/mini-app\/index\.html'/u,
      );
    });

    it("rejects a bundle with an empty mini-app/index.html", () => {
      const root = createTemporaryRoot();
      createDeployBundle(root, { miniAppIndex: "" });

      const result = runScript(verifyBundleFilesScript, {
        cwd: root,
        env: { BUNDLE_DIR: "bundle" },
      });

      assert.equal(result.status, 1);
      assert.match(
        result.output,
        /missing required non-empty file 'bundle\/mini-app\/index\.html'/u,
      );
    });

    it("rejects a symbolic link in the bundle payload", () => {
      const root = createTemporaryRoot();
      createDeployBundle(root);
      symlinkSync(
        "app.css",
        resolve(root, "bundle/mini-app/assets/linked.css"),
      );

      const result = runScript(verifyBundleFilesScript, {
        cwd: root,
        env: { BUNDLE_DIR: "bundle" },
      });

      assert.equal(result.status, 1);
      assert.match(
        result.output,
        /Mini App payload contains symbolic link 'bundle\/mini-app\/assets\/linked\.css'/u,
      );
    });
  });

  describe("deploy.yml published endpoint verification", () => {
    it("accepts the pinned profile page and asset without Hello World markers", () => {
      const root = createTemporaryRoot();

      const result = runPublishedEndpoint(root, "matching");

      assert.equal(result.status, 0, result.output);
      assert.match(readFileSync(resolve(root, "summary"), "utf8"), /Verified asset path: assets\/app\.css/u);
      assert.equal(readFileSync(resolve(root, "request-count"), "utf8").trim(), "1");
    });

    for (const overlay of ["{invalid", '{"functionBaseUrl":"https://other.azurewebsites.net"}',
      '{"functionBaseUrl":"https://func.azurewebsites.net","token":"secret"}']) {
      it(`rejects invalid generated overlay ${overlay.slice(0, 35)} before fetching published config`, () => {
        const root = createTemporaryRoot();
        const result = runPublishedEndpoint(root, "matching", "matching", "matching", overlay);
        assert.equal(result.status, 1, result.output);
        assert.match(result.output, /Generated runtime overlay is invalid/u);
        assert.equal(readFileSync(resolve(root, "request-count"), "utf8").trim(), "1");
      });
    }

    it("retries a stale HTTP 200 page until it matches the pinned bundle", () => {
      const root = createTemporaryRoot();

      const result = runPublishedEndpoint(root, "stale-once");

      assert.equal(result.status, 0, result.output);
      assert.equal(readFileSync(resolve(root, "request-count"), "utf8").trim(), "2");
    });

    it("rejects a stale HTTP 200 page after all attempts", () => {
      const root = createTemporaryRoot();

      const result = runPublishedEndpoint(root, "stale");

      assert.equal(result.status, 1);
      assert.match(result.output, /does not match the pinned CI bundle after 10 attempts/u);
      assert.equal(readFileSync(resolve(root, "request-count"), "utf8").trim(), "10");
    });

    it("rejects an HTTP 200 asset with content different from the bundle", () => {
      const root = createTemporaryRoot();

      const result = runPublishedEndpoint(root, "matching", "stale");

      assert.equal(result.status, 1);
      assert.match(result.output, /did not return HTTP 200 with the pinned CI bundle's content/u);
      assert.equal(readFileSync(resolve(root, "summary"), "utf8"), "");
    });

    for (const mode of ["missing", "html", "stale", "malformed", "wrong-schema", "different"] as const) {
      it(`rejects ${mode} published runtime config even when pinned assets match`, () => {
        const root = createTemporaryRoot();
        const result = runPublishedEndpoint(root, "matching", "matching", mode);
        assert.equal(result.status, 1, result.output);
        assert.match(result.output, /Published \/config\.json does not match/u);
        assert.equal(readFileSync(resolve(root, "request-count"), "utf8").trim(), "1");
      });
    }
  });

  describe("bundle metadata producer and consumer contract", () => {
    it("writes metadata that the deploy provenance gate accepts", () => {
      const root = createTemporaryRoot();
      createDeployBundle(root);
      rmSync(resolve(root, "bundle/metadata.json"));

      const producerResult = runScript(writeBundleMetadataScript, {
        cwd: root,
        env: {
          BUNDLE_DIR: "bundle",
          GITHUB_REPOSITORY: expectedRepository,
          GITHUB_SHA: expectedCommitSha,
          GITHUB_RUN_ID: expectedRunId,
          GITHUB_RUN_ATTEMPT: expectedRunAttempt,
        },
      });
      assert.equal(producerResult.status, 0, producerResult.output);

      const consumerResult = runScript(verifyBundleProvenanceScript, {
        cwd: root,
        env: {
          BUNDLE_DIR: "bundle",
          GITHUB_REPOSITORY: expectedRepository,
          EXPECTED_HEAD_SHA: expectedCommitSha,
          EXPECTED_RUN_ID: expectedRunId,
          EXPECTED_RUN_ATTEMPT: expectedRunAttempt,
        },
      });

      assert.equal(consumerResult.status, 0, consumerResult.output);
    });
  });
});
