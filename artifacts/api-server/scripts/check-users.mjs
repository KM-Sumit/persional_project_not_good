import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
  const result = await pool.query("SELECT email, mobile, role, name FROM users");
  console.log("Existing users:");
  result.rows.forEach(user => {
    console.log(`- Email: ${user.email}, Mobile: ${user.mobile}, Role: ${user.role}, Name: ${user.name}`);
  });
  await pool.end();
}

checkUsers().catch(console.error);
