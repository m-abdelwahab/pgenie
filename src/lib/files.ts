import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getErrorMessage } from "../utils/get-error-message.js";

export function createDrizzleConfig(dbModulePath: string) {
	return `
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./${path.join(dbModulePath, "schema.ts")}",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
	out: "./${dbModulePath}/migrations",
});
`;
}

export function createDbInit() {
	return `
import { drizzle } from 'drizzle-orm/postgres-js';

export const db = drizzle(process.env.DATABASE_URL);
`;
}

export async function updatePackageJson(
	dbModulePath: string,
	packageManager: string,
) {
	const packageJson = JSON.parse(await readFile("package.json", "utf-8"));

	const seedCommand =
		packageManager === "bun"
			? `bun run ${path.join(dbModulePath, "seed.ts")}`
			: `npx tsx ${path.join(dbModulePath, "seed.ts")}`;

	packageJson.scripts = {
		...packageJson.scripts,
		"db:generate": `drizzle-kit generate --config=${path.join(dbModulePath, "config.ts")}`,
		"db:migrate": `drizzle-kit migrate --config=${path.join(dbModulePath, "config.ts")}`,
		"db:seed": seedCommand,
	};

	await writeFile("package.json", JSON.stringify(packageJson, null, 2));
}

export async function findDbModulePath(): Promise<string> {
	try {
		// Read package.json
		const packageJson = JSON.parse(await readFile("package.json", "utf-8"));
		const generateScript = packageJson.scripts?.["db:generate"] || "";

		// Extract path from the generate script
		// Format: drizzle-kit generate --config=<path>/config.ts
		const match = generateScript.match(/--config=(.+?)\/config\.ts/);
		if (!match) {
			throw new Error(
				"Could not find database module path in package.json scripts",
			);
		}
		return path.join(match[1]);
	} catch (error) {
		throw new Error(
			`Failed to determine database module path: ${getErrorMessage(error)}`,
		);
	}
}

export async function getSchema(): Promise<string> {
	try {
		const dbModulePath = await findDbModulePath();
		const schemaPath = path.join(dbModulePath, "schema.ts");
		return await readFile(schemaPath, "utf-8");
	} catch (error) {
		throw new Error(
			`Failed to read schema from project: ${getErrorMessage(error)}`,
		);
	}
}
