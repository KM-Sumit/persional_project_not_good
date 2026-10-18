import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { hashPassword } from "./lib/auth";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Auto-create admin account on startup if credentials are provided
async function ensureAdminAccount() {
  // TEMPORARY: Hardcoded admin credentials for production - REMOVE AFTER FIRST DEPLOY
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || "admin@uci.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@12345678";
  const adminName = process.env.ADMIN_NAME?.trim() || "UCI Admin";
  const adminMobile = process.env.ADMIN_MOBILE?.trim() || "8888888888";

  if (!adminEmail || !adminPassword || !adminName || !adminMobile) {
    return; // Skip if admin credentials not configured
  }

  try {
    // Check if admin already exists
    const existing = await pool.query(
      "SELECT id, role FROM users WHERE email = $1",
      [adminEmail]
    );

    if (existing.rows.length > 0) {
      // Update existing user to admin role if not already
      if (existing.rows[0].role !== 'admin') {
        await pool.query(
          "UPDATE users SET role = 'admin' WHERE email = $1",
          [adminEmail]
        );
        logger.info({ email: adminEmail }, "Updated existing user to admin role");
      }
      return;
    }

    // Create new admin account
    const passwordHash = await hashPassword(adminPassword);
    await pool.query(
      `INSERT INTO users (name, email, mobile, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')`,
      [adminName, adminEmail, adminMobile, passwordHash]
    );
    logger.info({ email: adminEmail }, "Admin account created on startup");
  } catch (error) {
    logger.error({ error }, "Failed to ensure admin account");
  }
}

// Run admin check on startup
ensureAdminAccount().catch(() => {});

export default app;
