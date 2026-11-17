// PostgreSQL em memória para migrações + pgTAP, sem Docker nem dados remotos.
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgtap } from "@electric-sql/pglite-pgtap";

const root = fileURLToPath(new URL("../../", import.meta.url));
const db = new PGlite({ extensions: { pgcrypto, pgtap } });
let checks = 0;
let failures = 0;
try {
  await db.exec('set search_path = public, extensions;');
  await db.exec(await readFile(resolve(root, "scripts/local/supabase-stub.sql"), "utf8"));
  for (const file of (await readdir(resolve(root, "supabase/migrations"))).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(await readFile(resolve(root, "supabase/migrations", file), "utf8"));
  }
  for (const file of (await readdir(resolve(root, "supabase/tests"))).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = await readFile(resolve(root, "supabase/tests", file), "utf8");
    // O psql envia a preparação fora da transação; uma única exec faria rollback dela.
    const start = file === "00000_setup.sql" ? sql.lastIndexOf("\nbegin;") : -1;
    if (start >= 0) await db.exec(sql.slice(0, start));
    const results = await db.exec(start >= 0 ? sql.slice(start) : sql);
    const output = results.flatMap((result) => result.rows.flatMap((row) => Object.values(row))).filter((v) => typeof v === "string");
    const passed = output.filter((v) => /^ok \d+/.test(v)).length;
    const failed = output.filter((v) => /^not ok \d+/.test(v));
    checks += passed + failed.length;
    failures += failed.length;
    console.log(file + ": " + passed + " passed" + (failed.length ? ", " + failed.length + " FAILED\n" + failed.join("\n") : ""));
    const plans = output.filter((v) => /^1\.\.\d+/.test(v));
    if (!plans.length || plans.some((plan) => Number(plan.match(/^1\.\.(\d+)/)[1]) !== passed + failed.length)) {
      failures++; console.error("TAP plan mismatch: " + file);
    }
  }
  console.log(checks + " database assertions, " + failures + " failures");
  if (failures) process.exitCode = 1;
} catch (error) {
  console.error("Database test error:", error.message, error.code ?? "", error.where ?? "");
  process.exitCode = 1;
} finally { await db.close(); }
