#!/usr/bin/env node
// Validates ~/.scaffold-anything/.env against all required keys in .env.example

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const envPath = join(homedir(), ".scaffold-anything", ".env");
const examplePath = new URL(".env.example", import.meta.url).pathname;

function parseEnv(content) {
  return Object.fromEntries(
    content
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"))
      .map((l) => l.split("=").map((s) => s.trim()))
      .filter(([k]) => k)
      .map(([k, v = ""]) => [k, v])
  );
}

let example, env;

try {
  example = parseEnv(readFileSync(examplePath, "utf8"));
} catch {
  console.error(`Could not read .env.example at ${examplePath}`);
  process.exit(1);
}

try {
  env = parseEnv(readFileSync(envPath, "utf8"));
} catch {
  console.error(`No config found at ${envPath}`);
  console.error(`Copy .env.example to that path and fill in your values.`);
  process.exit(1);
}

const required = Object.keys(example);
const missing = required.filter((k) => !env[k]);
const empty = required.filter((k) => env[k] !== undefined && env[k] === "");

if (missing.length === 0 && empty.length === 0) {
  console.log(`✓ All ${required.length} required vars are set.`);
  process.exit(0);
}

if (missing.length) {
  console.error(`\nMissing vars (not in your .env):`);
  missing.forEach((k) => console.error(`  ✗ ${k}`));
}

if (empty.length) {
  console.error(`\nEmpty vars (present but not filled in):`);
  empty.forEach((k) => console.error(`  ✗ ${k}`));
}

process.exit(1);
