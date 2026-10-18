import { pool } from "@workspace/db";

async function checkUsers() {
  const result = await pool.query("SELECT email, mobile, role, name FROM users");
  console.log("Existing users:");
  result.rows.forEach(user => {
    console.log(`- Email: ${user.email}, Mobile: ${user.mobile}, Role: ${user.role}, Name: ${user.name}`);
  });
  await pool.end();
}

checkUsers().catch(console.error);
