import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { build } from "vite";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const miniAppRoot = resolve(repositoryRoot, "src/mini-app");
const telegramBridgeUrl = "https://telegram.org/js/telegram-web-app.js";

describe("Mini App production build", () => {
  it("emits the expected entry and only valid local assets plus the Telegram bridge", async () => {
    const temporaryRoot = await mkdtemp(
      resolve(tmpdir(), "experiments-ai-bot-mini-app-build-"),
    );
    const outputDirectory = resolve(temporaryRoot, "dist");

    try {
      await build({
        root: miniAppRoot,
        logLevel: "silent",
        build: {
          emptyOutDir: true,
          outDir: outputDirectory,
        },
      });

      const entryPath = resolve(outputDirectory, "index.html");
      const entryStats = await stat(entryPath);
      const entry = await readFile(entryPath, "utf8");

      assert.ok(entryStats.isFile());
      assert.ok(entryStats.size > 0);
      assert.match(
        entry,
        /<title>Telegram User Profile<\/title>/u,
      );
      assert.match(entry, /<main id="app" aria-live="polite"><\/main>/u);
      assert.match(
        entry,
        /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1\.0"\s*\/?>/u,
      );

      const references = [
        ...entry.matchAll(/\b(?:href|src)="([^"]+)"/gu),
      ].map((match) => match[1]);
      assert.ok(references.length >= 3);

      const externalReferences: string[] = [];
      for (const reference of references) {
        assert.ok(reference);

        if (
          /^[a-z][a-z\d+.-]*:/iu.test(reference) ||
          reference.startsWith("//")
        ) {
          externalReferences.push(reference);
          continue;
        }

        const localPath = reference.split(/[?#]/u, 1)[0];
        assert.ok(localPath);
        const assetPath = resolve(
          outputDirectory,
          decodeURIComponent(localPath.replace(/^\/+/u, "")),
        );
        const relativeAssetPath = relative(outputDirectory, assetPath);
        assert.ok(
          relativeAssetPath !== "" &&
            !relativeAssetPath.startsWith("..") &&
            !isAbsolute(relativeAssetPath),
          `Generated asset reference escapes output: ${reference}`,
        );

        const assetStats = await stat(assetPath);
        assert.ok(assetStats.isFile());
        assert.ok(
          assetStats.size > 0,
          `Generated asset is empty: ${relativeAssetPath}`,
        );
      }

      assert.deepEqual(externalReferences, [telegramBridgeUrl]);
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });
});
