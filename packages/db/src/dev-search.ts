// Start the Quickwit search node via docker-compose.dev.yml.
// Derives QW_METASTORE_URI from DATABASE_URL (same credentials, database
// `quickwit`, host `host.docker.internal` so the container reaches host Postgres).
//
// The container is left running when this process exits (Ctrl-C / concurrently
// teardown): stopping it from a signal handler is unreliable under pnpm/tsx, and
// a leftover searcher is fine for local dev. `pnpm db:clear` / compose down
// still remove it. This process just ensures it is up and exits if it dies.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const qwdata = resolve(root, "apps/data/qwdata");
const composeArgs = ["compose", "-f", "docker-compose.dev.yml"];

/** Rewrite any Postgres URL to the Quickwit metastore as seen from Compose. */
function dockerMetastoreUri(sourceUrl: string): string {
  const u = new URL(sourceUrl);
  u.hostname = "host.docker.internal";
  u.pathname = "/quickwit";
  u.search = "";
  u.hash = "";
  return u.toString();
}

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres";
const qwMetastoreUri = dockerMetastoreUri(process.env.QW_METASTORE_URI ?? databaseUrl);

const env = {
  ...process.env,
  QW_METASTORE_URI: qwMetastoreUri,
};

function compose(args: string[]) {
  return spawnSync("docker", [...composeArgs, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

mkdirSync(qwdata, { recursive: true });

const up = compose(["up", "-d", "--pull", "missing", "quickwit"]);
if (up.status !== 0) {
  process.stderr.write(up.stderr || up.stdout || "docker compose up failed\n");
  process.exit(up.status ?? 1);
}

if (!compose(["ps", "-q", "quickwit"]).stdout.trim()) {
  process.stderr.write("quickwit: container did not start\n");
  process.stderr.write(up.stderr || up.stdout || "");
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => process.exit(0));
}

async function waitUntilReady(timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://127.0.0.1:7280/api/v1/version");
      if (res.ok) return true;
    } catch {
      // not listening yet
    }
    if (!compose(["ps", "-q", "--status", "running", "quickwit"]).stdout.trim()) {
      return false;
    }
    await sleep(500);
  }
  return false;
}

if (!(await waitUntilReady())) {
  process.stderr.write("quickwit: failed to become ready on :7280\n");
  const logs = compose(["logs", "--tail", "80", "quickwit"]);
  process.stderr.write(logs.stdout || "");
  process.stderr.write(logs.stderr || "");
  process.exit(1);
}
process.stdout.write("REST server is ready\n");

// Stay alive for concurrently while the container runs.
while (true) {
  await sleep(5_000);
  if (!compose(["ps", "-q", "--status", "running", "quickwit"]).stdout.trim()) {
    process.stderr.write("quickwit: container exited\n");
    const logs = compose(["logs", "--tail", "80", "quickwit"]);
    process.stderr.write(logs.stdout || "");
    process.stderr.write(logs.stderr || "");
    process.exit(1);
  }
}
