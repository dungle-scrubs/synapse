import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Tests for the synapse CLI (cli.ts).
 *
 * Runs the CLI as a subprocess to verify arg parsing, JSON output,
 * file creation, and error handling end-to-end.
 */

/** Run the CLI with given args and return stdout, stderr, exitCode. */
async function runCli(
	args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const proc = Bun.spawn(["bun", "run", "src/cli.ts", ...args], {
		cwd: path.resolve(import.meta.dir, ".."),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const exitCode = await proc.exited;
	return { stdout, stderr, exitCode };
}

/** Temp directory for file-writing tests. */
let tmpDir: string;

afterEach(() => {
	if (tmpDir && fs.existsSync(tmpDir)) {
		fs.rmSync(tmpDir, { recursive: true });
	}
});

describe("synapse CLI", () => {
	it("prints help with --help", async () => {
		const { stdout, exitCode } = await runCli(["--help"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("synapse CLI");
		expect(stdout).toContain("init-overrides");
	});

	it("prints help with no args", async () => {
		const { stdout, exitCode } = await runCli([]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("synapse CLI");
	});

	it("rejects unknown commands", async () => {
		const { stderr, exitCode } = await runCli(["bogus"]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("Unknown command");
	});

	it("prints valid JSON to stdout with --stdout", async () => {
		const { stdout, exitCode } = await runCli(["init-overrides", "--stdout"]);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		expect(parsed).toHaveProperty("matrixOverrides");
	});

	it("prints empty template with --stdout --empty", async () => {
		const { stdout, exitCode } = await runCli(["init-overrides", "--stdout", "--empty"]);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		expect(parsed.matrixOverrides).toEqual({});
	});

	it("writes file to specified path", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-cli-"));
		const outPath = path.join(tmpDir, "overrides.json");
		const { exitCode } = await runCli(["init-overrides", outPath]);
		expect(exitCode).toBe(0);
		expect(fs.existsSync(outPath)).toBe(true);
		const content = JSON.parse(fs.readFileSync(outPath, "utf-8"));
		expect(content).toHaveProperty("matrixOverrides");
	});

	it("refuses to overwrite existing file without --force", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-cli-"));
		const outPath = path.join(tmpDir, "overrides.json");
		fs.writeFileSync(outPath, "existing", "utf-8");
		const { stderr, exitCode } = await runCli(["init-overrides", outPath]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("Refusing to overwrite");
		expect(fs.readFileSync(outPath, "utf-8")).toBe("existing");
	});

	it("overwrites existing file with --force", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-cli-"));
		const outPath = path.join(tmpDir, "overrides.json");
		fs.writeFileSync(outPath, "old", "utf-8");
		const { exitCode } = await runCli(["init-overrides", outPath, "--force"]);
		expect(exitCode).toBe(0);
		const content = JSON.parse(fs.readFileSync(outPath, "utf-8"));
		expect(content).toHaveProperty("matrixOverrides");
	});

	it("generate-overrides is an alias for init-overrides", async () => {
		const { stdout, exitCode } = await runCli(["generate-overrides", "--stdout"]);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		expect(parsed).toHaveProperty("matrixOverrides");
	});

	it("rejects unknown options", async () => {
		const { stderr, exitCode } = await runCli(["init-overrides", "--bogus"]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("Unknown option");
	});
});
