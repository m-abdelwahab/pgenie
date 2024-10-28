import inquirer from "inquirer";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import chalk from "chalk";
import ora from "ora";
import { generateSchema, generateSeedScript } from "../lib/ai.js";
import {
	createDrizzleConfig,
	createDbInit,
	updatePackageJson,
} from "../lib/files.js";
import { appendFile, mkdir, writeFile } from "node:fs/promises";

const execAsync = promisify(exec);

export async function init() {
	try {
		// Get project name
		const currentDir = path.basename(process.cwd());
		const { projectName } = await inquirer.prompt([
			{
				type: "input",
				name: "projectName",
				message: "What is your project name?",
				default: currentDir,
			},
		]);

		// Get package manager
		const { packageManager } = await inquirer.prompt([
			{
				type: "list",
				name: "packageManager",
				message: "Which package manager do you use?",
				choices: ["npm", "yarn", "pnpm", "bun"],
			},
		]);

		// Check Neon CLI
		const spinner = ora("Checking Neon CLI installation...").start();
		try {
			await execAsync("neonctl me");
			spinner.succeed("Neon CLI is installed and configured");
		} catch (error) {
			spinner.fail("Neon CLI is not installed or not configured");
			console.log(
				chalk.yellow(
					"\nPlease install Neon CLI and run neonctl auth to configure it.",
				),
			);
			process.exit(1);
		}

		if (!process.env.ANTHROPIC_API_KEY) {
			console.log(
				chalk.yellow(
					"\nPlease set the ANTHROPIC_API_KEY environment variable to use the AI features.",
				),
			);
			process.exit(1);
		}

		// Get database module path
		const { dbModulePath } = await inquirer.prompt([
			{
				type: "input",
				name: "dbModulePath",
				message: "Where would you like to store your database module?",
				default: "app/lib/db",
			},
		]);

		// Install packages
		spinner.start("Installing required packages...");
		const installCmd = {
			npm: "npm install",
			yarn: "yarn add",
			pnpm: "pnpm add",
			bun: "bun add",
		}[packageManager as "npm" | "yarn" | "pnpm" | "bun"];

		if (packageManager !== "bun") {
			await execAsync(`${installCmd} -D tsx`);
		}
		await execAsync(`${installCmd} drizzle-orm postgres`);
		await execAsync(`${installCmd} -D drizzle-kit`);
		spinner.succeed("Packages installed");

		// Create Neon project
		spinner.start("Creating Neon project...");
		await execAsync(
			`neonctl projects create --name ${projectName} --set-context`,
		);
		const { stdout: connectionString } = await execAsync(
			"neonctl connection-string",
		);
		await appendFile(".env", `\nDATABASE_URL=${connectionString.trim()}\n`);
		spinner.succeed("Neon project created");

		// Create directory structure
		await mkdir(dbModulePath, { recursive: true });

		// Create files
		await writeFile(
			path.join(dbModulePath, "config.ts"),
			createDrizzleConfig(dbModulePath),
		);

		await writeFile(path.join(dbModulePath, "index.ts"), createDbInit());

		// Update package.json
		await updatePackageJson(dbModulePath, packageManager);

		// Get AI prompt
		const { prompt } = await inquirer.prompt([
			{
				type: "input",
				name: "prompt",
				message: "Describe your app and data model:",
				validate: (input) => input.length > 0,
			},
		]);

		// Generate schema
		spinner.start("Generating schema...");
		const schema = await generateSchema(prompt);
		await writeFile(path.join(dbModulePath, "schema.ts"), schema);
		spinner.succeed("Schema generated successfully");

		// Generate seed script
		spinner.start("Generating seed script...");
		const seed = await generateSeedScript(schema, prompt);
		await writeFile(path.join(dbModulePath, "seed.ts"), seed);
		spinner.succeed("Seed script generated successfully");

		spinner.start("Running migrations and seed...");
		await execAsync("npm run db:generate");
		spinner.succeed("Database schema generated");

		await execAsync("npm run db:migrate");
		spinner.succeed("Database migrated");

		console.log(
			chalk.green(
				"\n✨ Project initialized successfully! You can seed your database by running the db:seed",
			),
		);
	} catch (error) {
		console.error(chalk.red("Error initializing project:"), error);
		process.exit(1);
	}
}
