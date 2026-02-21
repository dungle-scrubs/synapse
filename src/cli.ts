#!/usr/bin/env node

/**
 * synapse CLI.
 *
 * Generates editable model-matrix override templates that host apps
 * (for example tallow) can pass to synapse via `matrixOverrides`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createModelMatrixOverrideTemplate } from "./matrix.js";

/** Parsed CLI options for the `init-overrides` command. */
interface InitOverridesArgs {
	force: boolean;
	includeCurrentMatrix: boolean;
	outputPath: string;
	stdout: boolean;
}

/** Supported CLI commands. */
const COMMANDS = new Set(["init-overrides", "generate-overrides"]);

/** Default output filename for generated override templates. */
const DEFAULT_OUTPUT_PATH = "synapse.model-overrides.json";

/** Help text for the CLI. */
const HELP_TEXT = `synapse CLI

Usage:
  synapse init-overrides [path] [--empty] [--force] [--stdout]
  synapse generate-overrides [path] [--empty] [--force] [--stdout]

Commands:
  init-overrides     Generate a matrix override template JSON file
  generate-overrides Alias of init-overrides

Options:
  --empty    Generate an empty template (no copied base matrix)
  --force    Overwrite output file if it already exists
  --stdout   Print JSON to stdout instead of writing a file
  --help     Show this help message
`;

/**
 * Expand leading `~` in paths to the current HOME directory.
 *
 * @param rawPath - Raw path argument from CLI
 * @returns Path with `~` expanded when possible
 */
function expandHome(rawPath: string): string {
	const home = process.env.HOME;
	if (!home) return rawPath;
	if (rawPath === "~") return home;
	if (rawPath.startsWith("~/")) return path.join(home, rawPath.slice(2));
	return rawPath;
}

/**
 * Parse argv for the override-template command.
 *
 * @param argv - Process argv array
 * @returns Parsed args, undefined when help was shown
 * @throws Error when arguments are invalid
 */
function parseInitOverridesArgs(argv: readonly string[]): InitOverridesArgs | undefined {
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(HELP_TEXT);
		return undefined;
	}

	const positional: string[] = [];
	let force = false;
	let includeCurrentMatrix = true;
	let stdout = false;

	for (const arg of argv) {
		if (arg === "--force") {
			force = true;
			continue;
		}
		if (arg === "--empty") {
			includeCurrentMatrix = false;
			continue;
		}
		if (arg === "--stdout") {
			stdout = true;
			continue;
		}
		if (arg.startsWith("-")) {
			throw new Error(`Unknown option: ${arg}`);
		}
		positional.push(arg);
	}

	if (positional.length > 1) {
		throw new Error("Too many positional arguments. Expected at most one output path.");
	}

	return {
		force,
		includeCurrentMatrix,
		outputPath: positional[0] ?? DEFAULT_OUTPUT_PATH,
		stdout,
	};
}

/**
 * Build pretty JSON content for the override template file.
 *
 * @param includeCurrentMatrix - Whether to copy the current base matrix into the template
 * @returns JSON string ending in a newline
 */
function buildTemplateJson(includeCurrentMatrix: boolean): string {
	const template = createModelMatrixOverrideTemplate({ includeCurrentMatrix });
	return `${JSON.stringify(template, null, 2)}\n`;
}

/**
 * Execute the CLI command.
 *
 * @param argv - Process argv array
 * @returns Process exit code
 */
function run(argv: readonly string[]): number {
	const [command, ...rest] = argv;

	if (!command || command === "--help" || command === "-h") {
		console.log(HELP_TEXT);
		return 0;
	}

	if (!COMMANDS.has(command)) {
		console.error(`Unknown command: ${command}`);
		console.error("Use --help to see supported commands.");
		return 1;
	}

	try {
		const parsed = parseInitOverridesArgs(rest);
		if (!parsed) return 0;

		const content = buildTemplateJson(parsed.includeCurrentMatrix);
		if (parsed.stdout) {
			process.stdout.write(content);
			return 0;
		}

		const resolvedPath = path.resolve(process.cwd(), expandHome(parsed.outputPath));
		if (!parsed.force && fs.existsSync(resolvedPath)) {
			console.error(`Refusing to overwrite existing file: ${resolvedPath}`);
			console.error("Pass --force to overwrite.");
			return 1;
		}

		fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
		fs.writeFileSync(resolvedPath, content, "utf-8");

		console.log(`Wrote override template: ${resolvedPath}`);
		console.log("Pass template.matrixOverrides to synapse as the matrixOverrides option.");
		return 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		return 1;
	}
}

const exitCode = run(process.argv.slice(2));
if (exitCode !== 0) process.exitCode = exitCode;
