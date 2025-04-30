import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

// Write a temporary config
const tempConfig = `
import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!
  },
  verbose: true,
  strict: true,
} satisfies Config;
`;

writeFileSync('temp-drizzle.config.ts', tempConfig);

// Run push
try {
  console.log('Pushing schema to database...');
  execSync('npx drizzle-kit push:pg --config=temp-drizzle.config.ts', { stdio: 'inherit' });
  console.log('Schema pushed successfully!');
} catch (error) {
  console.error('Error pushing schema:', error);
} finally {
  // Clean up
  try {
    unlinkSync('temp-drizzle.config.ts');
  } catch (err) {
    console.error('Error cleaning up:', err);
  }
}
