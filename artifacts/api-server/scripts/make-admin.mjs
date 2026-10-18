import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function makeAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@test.com';
  const result = await pool.query(
    "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, name, email, mobile, role",
    [email]
  );
  console.log("User updated to admin:", result.rows[0]);
  await pool.end();
}

makeAdmin().catch(console.error);
