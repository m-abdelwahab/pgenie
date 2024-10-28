import { getErrorMessage } from "../utils/get-error-message.js";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) {
	throw new Error("ANTHROPIC_API_KEY environment variable is not set");
}

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateSchema(
	prompt: string,
	existingSchema?: string | null,
) {
	const schemaPrompt = `You are a database architect tasked with modifying a Drizzle ORM schema based on user requirements. Follow these instructions precisely:

    ${
			existingSchema
				? `CURRENT SCHEMA:\n\`\`\`typescript\n${existingSchema}\n\`\`\`\n`
				: "This is a new schema with no existing tables."
		}
    
    USER REQUIREMENTS:
    ${prompt}
    
    INSTRUCTIONS:
    1. Schema Modification Rules:
         - Keep all imports from the existing schema
         - Preserve all existing table and column names unless explicitly requested to change
         - Maintain existing relationships and foreign keys unless changes are required
         - When adding new columns to existing tables, add them at the end of the table definition
         - If adding a non-nullable column to an existing table, make it nullable or provide a default value
         - Preserve any existing indexes, unique constraints, and check constraints
    
    2. When Adding New Features:
         - Use descriptive table and column names in camelCase
         - Add appropriate indexes for foreign keys and frequently queried fields
         - Include proper relationships using references()
         - Add constraints for data integrity (unique, check, etc.)
         - Add timestamp() columns for created_at/updated_at where appropriate
         - Add appropriate numeric precision for decimal/numeric types
    
    3. Type Guidelines:
         - Use varchar() with appropriate lengths for short text
         - Use text() for long-form content
         - Use integer() for IDs and standard numbers
         - Use decimal() with proper precision for financial values
         - Use timestamp() for date/time fields
         - Use boolean() for true/false flags
         - Use json() or jsonb() for structured data
         - Use enum() for fixed sets of values
    
    4. Required Format:
         - Generate only the TypeScript/Drizzle schema code. Make sure to export all tables and types
         - Include all necessary imports
         - Include all table definitions
         - Do not include explanatory comments
         - Do not wrap the response in markdown code blocks
         - Do not include ANY explanatory text before or after the code
    
    IMPORTANT: Respond with only the schema code, no additional text or formatting.
    
    Generate the schema now:`;

	try {
		const response = await anthropic.messages.create({
			model: "claude-3-5-sonnet-20241022",
			messages: [{ content: schemaPrompt, role: "user" }],
			max_tokens: 8192,
		});

		if (response.content[0].type !== "text") {
			throw new Error(
				"Failed to generate schema: Invalid response from AI model",
			);
		}

		return response.content[0].text
			.trim()
			.replace(/```typescript/g, "")
			.replace(/```/g, "")
			.trim();
	} catch (error) {
		throw new Error(`Failed to generate schema: ${getErrorMessage(error)}`);
	}
}

export async function generateSeedScript(schema: string, prompt: string) {
	const seedPrompt = `You are generating a seed script for a Drizzle ORM database. Use the following schema and requirements:
    
    SCHEMA:
    \`\`\`typescript
    ${schema}
    \`\`\`
    
    USER REQUIREMENTS:
    ${prompt}
    
    INSTRUCTIONS:
    1. Seed Script Requirements:
         - Include all necessary imports from the schema file
         - Import and use the db client from './index'
         - Use proper Drizzle insert syntax
         - Generate realistic-looking sample data
         - Maintain referential integrity between tables
         - Include at least 5 records per table (unless specified otherwise)
         - Handle foreign key relationships correctly
         - Use batch inserts for better performance
    
    2. Data Guidelines:
         - Generate realistic names, emails, and content
         - Make sure to use the correct types to match the schema
         - Use varied but plausible dates
         - Create meaningful relationships between records
         - Include edge cases and different scenarios
         - Ensure numeric data is within reasonable ranges
         - Use realistic text lengths for content fields
    
    3. Required Format:
         - Generate only the TypeScript seed code
         - Do not include any external libraries or dependencies. only use Drizzle and standard libraries
         - Include necessary imports and db client setup
         - Include all insert statements
         - Do not include explanatory comments
         - Do not wrap the response in markdown code blocks
         - Do not include ANY explanatory text before or after the code
    
    IMPORTANT: Respond with only the seed code, no additional text or formatting.
    
    Generate the seed script now:`;

	try {
		const response = await anthropic.messages.create({
			model: "claude-3-5-sonnet-20241022",
			messages: [{ content: seedPrompt, role: "user" }],
			max_tokens: 8192,
		});

		if (response.content[0].type !== "text") {
			throw new Error(
				"Failed to generate seed script: Invalid response from AI model",
			);
		}

		return response.content[0].text
			.trim()
			.replace(/```typescript/g, "")
			.replace(/```/g, "")
			.trim();
	} catch (error) {
		throw new Error(
			`Failed to generate seed script: ${getErrorMessage(error)}`,
		);
	}
}
