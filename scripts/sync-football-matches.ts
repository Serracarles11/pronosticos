import nextEnv from "@next/env";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const { getDefaultFootballSyncRange, syncFootballMatches } = await import("../lib/football-data/sync.ts");
  const range = getDefaultFootballSyncRange();
  const result = await syncFootballMatches(range);
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "error") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
