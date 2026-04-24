import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "../../..");

function loadSvgDataUri(filename: string): string {
  const buf = readFileSync(resolve(repoRoot, filename));
  return `data:image/svg+xml;base64,${buf.toString("base64")}`;
}

let cache: Assets | null = null;

export interface Assets {
  logoWhite: string;
  logoDark: string;
  lunaspotWhite: string;
  lunaspotDark: string;
}

export function loadAssets(): Assets {
  if (cache) return cache;
  cache = {
    logoWhite: loadSvgDataUri("logo.svg"),
    logoDark: loadSvgDataUri("logo-dark.svg"),
    lunaspotWhite: loadSvgDataUri("lunaspot-logo.svg"),
    lunaspotDark: loadSvgDataUri("lunaspot-logo-dark.svg"),
  };
  return cache;
}
