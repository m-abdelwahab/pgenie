#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./commands/init.js";
import { generate } from "./commands/generate.js";

const program = new Command();

program
	.name("pgenie")
	.description(
		"CLI tool for scaffolding Drizzle ORM + Neon projects with AI-generated schemas",
	)
	.version("0.0.1");

program
	.command("init")
	.description("Initialize a new project with Drizzle ORM and Neon")
	.action(init);

program
	.command("generate")
	.description("Generate or update schema based on AI prompt")
	.action(generate);

program.parse();
