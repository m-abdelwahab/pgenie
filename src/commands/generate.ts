import inquirer from "inquirer";
import chalk from "chalk";
import { createPatch, applyPatch } from "diff";
import { generateSchema } from "../lib/ai.js";
import { writeFile } from "node:fs/promises";
import { findDbModulePath, getSchema } from "../lib/files.js";
import path from "node:path";
import ora from "ora";

export async function generate() {
	try {
		// Get the prompt
		const { prompt } = await inquirer.prompt([
			{
				type: "input",
				name: "prompt",
				message: "Describe the changes you want to make to your data model:",
				validate: (input) => input.length > 0,
			},
		]);

		const spinner = ora("Generating changes...").start();

		const currentSchema = await getSchema();
		const schema = await generateSchema(prompt);

		// Generate diff
		const diff = createPatch("schema.ts", currentSchema, schema);
		spinner.succeed("Changes generated ✨");

		console.log(chalk.cyan("\nProposed changes:"));
		console.log(
			diff
				.split("\n")
				.map((line) => {
					if (line.startsWith("+")) return chalk.green(line);
					if (line.startsWith("-")) return chalk.gray(line);
					if (line.startsWith("@@")) return chalk.cyan(line);
					return line;
				})
				.join("\n"),
		);

		// Ask for confirmation
		const { confirm } = await inquirer.prompt([
			{
				type: "confirm",
				name: "confirm",
				message: "Would you like to apply these changes?",
				default: false,
			},
		]);

		if (confirm) {
			const spinner = ora("Updating schema...").start();

			const mergedContent = applyPatch(currentSchema, diff);

			if (!mergedContent) {
				throw new Error("Failed to merge changes");
			}

			const dbModulePath = await findDbModulePath();
			const schemaPath = path.join(dbModulePath, "schema.ts");
			await writeFile(schemaPath, mergedContent);
			spinner.succeed(
				"Schema updated ✨ Review the changes, generate migrations, and apply them.",
			);

			process.exit(0);
		} else {
			console.log(chalk.yellow("\nOperation cancelled."));
		}
	} catch (error) {
		console.error(chalk.red("Error generating schema:"), error);
		process.exit(1);
	}
}
