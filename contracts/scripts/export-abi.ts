import hre from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const artifact = await hre.artifacts.readArtifact("FoodTraceability");
  const data = {
    contractName: "FoodTraceability",
    abi: artifact.abi,
  };

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(__dirname, "../abi");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "FoodTraceability.json");

  writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`ABI exported to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
