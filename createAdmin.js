// Script to create an admin user with hashed password
import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdminUser() {
  const email = "director@mosspointmainstreet.org";
  const username = "director";
  const password = "MPMainStreet2025!";
  const role = "admin";
  const name = "Moss Point Director";
  
  try {
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    console.log("=== Admin User Details ===");
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Role: ${role}`);
    console.log(`Name: ${name}`);
    console.log(`Hashed Password: ${hashedPassword}`);
    console.log("========================");
    console.log("Use these details to run the INSERT SQL query manually");
    
    // Generate ready-to-use SQL query
    console.log("\nSQL Query:");
    console.log(`INSERT INTO users (username, email, password, role, name, created_at, updated_at)`);
    console.log(`VALUES ('${username}', '${email}', '${hashedPassword}', '${role}', '${name}', NOW(), NOW());`);
  } catch (error) {
    console.error("Error generating password hash:", error);
  }
}

createAdminUser();