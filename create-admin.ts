import { hashPassword } from './server/auth';

async function createAdmin() {
  const email = "director@mosspointmainstreet.org";
  const username = "director";
  const password = "MPMainStreet2025!";
  const role = "admin";
  const name = "Moss Point Director";
  
  const hashedPassword = await hashPassword(password);
  
  console.log("\nSQL Query:");
  console.log(`INSERT INTO users (username, email, password, role, name, created_at, updated_at)`);
  console.log(`VALUES ('${username}', '${email}', '${hashedPassword}', '${role}', '${name}', NOW(), NOW());`);
}

createAdmin().catch(console.error);