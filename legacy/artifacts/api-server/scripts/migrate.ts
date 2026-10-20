import { pool } from "@workspace/db";

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.info("Starting safe database migration...");
    await client.query("BEGIN");

    // 1. Create exam_categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT 'award',
        sort_order INTEGER NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS exam_categories_slug_unique ON exam_categories(slug);
      CREATE INDEX IF NOT EXISTS exam_categories_enabled_order_idx ON exam_categories(enabled, sort_order);
    `);

    // 2. Create exams table
    await client.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES exam_categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS exams_slug_unique ON exams(slug);
      CREATE INDEX IF NOT EXISTS exams_category_idx ON exams(category_id, sort_order);
    `);

    // 3. Extend tests table
    await client.query(`
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS exam_id INTEGER REFERENCES exams(id) ON DELETE SET NULL;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS test_type TEXT NOT NULL DEFAULT 'practice';
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS instructions TEXT NOT NULL DEFAULT '';
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS marks_per_question REAL NOT NULL DEFAULT 1.0;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS negative_marking REAL NOT NULL DEFAULT 0.0;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS total_marks REAL NOT NULL DEFAULT 0.0;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS access_password_hash TEXT;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS year INTEGER;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS shift TEXT;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'Hindi';
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS source_info TEXT NOT NULL DEFAULT '';
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS is_verified_pyq BOOLEAN NOT NULL DEFAULT false;

      CREATE INDEX IF NOT EXISTS tests_exam_id_idx ON tests(exam_id);
      CREATE INDEX IF NOT EXISTS tests_test_type_idx ON tests(test_type);
      CREATE INDEX IF NOT EXISTS tests_scheduled_start_idx ON tests(scheduled_start_at);
      CREATE INDEX IF NOT EXISTS tests_status_idx ON tests(status);
    `);

    // Backfill status for existing published tests
    await client.query(`
      UPDATE tests SET status = 'published' WHERE published = true AND status = 'draft';
    `);

    // 4. Extend test_questions table
    await client.query(`
      ALTER TABLE test_questions ADD COLUMN IF NOT EXISTS marks REAL NOT NULL DEFAULT 1.0;
      ALTER TABLE test_questions ADD COLUMN IF NOT EXISTS negative_marks REAL NOT NULL DEFAULT 0.0;
    `);

    // 5. Extend test_attempts table
    await client.query(`
      ALTER TABLE test_attempts ADD COLUMN IF NOT EXISTS total_marks REAL;
      ALTER TABLE test_attempts ADD COLUMN IF NOT EXISTS max_marks REAL;
      ALTER TABLE test_attempts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in_progress';
      ALTER TABLE test_attempts ALTER COLUMN score TYPE REAL USING score::real;
      ALTER TABLE test_attempts ALTER COLUMN percentage TYPE REAL USING percentage::real;
      ALTER TABLE test_attempts ALTER COLUMN accuracy TYPE REAL USING accuracy::real;

      CREATE INDEX IF NOT EXISTS test_attempts_status_idx ON test_attempts(status);
    `);

    // Backfill status for already submitted attempts
    await client.query(`
      UPDATE test_attempts SET status = 'submitted' WHERE submitted_at IS NOT NULL AND status = 'in_progress';
    `);

    // 6. Create test_access_attempts table for rate limiting
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_access_attempts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
        ip TEXT NOT NULL DEFAULT '',
        failed_count INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS test_access_attempts_user_test_idx ON test_access_attempts(user_id, test_id);
      CREATE INDEX IF NOT EXISTS test_access_attempts_ip_test_idx ON test_access_attempts(ip, test_id);
    `);

    // 7. Seed default categories and exams if not existing
    const ssc = await client.query(`
      INSERT INTO exam_categories (name, slug, description, icon, sort_order, enabled)
      VALUES ('SSC Exams', 'ssc-exams', 'Staff Selection Commission Exams for Central Govt Jobs', 'award', 1, true)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const sscId = ssc.rows[0]?.id;

    const railway = await client.query(`
      INSERT INTO exam_categories (name, slug, description, icon, sort_order, enabled)
      VALUES ('Railway Exams', 'railway-exams', 'Railway Recruitment Board (RRB) Exams', 'trending-up', 2, true)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const railwayId = railway.rows[0]?.id;

    const mppsc = await client.query(`
      INSERT INTO exam_categories (name, slug, description, icon, sort_order, enabled)
      VALUES ('MPPSC', 'mppsc-exams', 'Madhya Pradesh Public Service Commission State Services', 'book-open', 3, true)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const mppscId = mppsc.rows[0]?.id;

    const mpPolice = await client.query(`
      INSERT INTO exam_categories (name, slug, description, icon, sort_order, enabled)
      VALUES ('MP Police', 'mp-police-exams', 'Madhya Pradesh Police Recruitment Examinations', 'shield', 4, true)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const mpPoliceId = mpPolice.rows[0]?.id;

    // Seed exams
    const examsData = [
      // SSC
      { catId: sscId, name: 'SSC CGL', slug: 'ssc-cgl', desc: 'Combined Graduate Level Examination', order: 1 },
      { catId: sscId, name: 'SSC CHSL', slug: 'ssc-chsl', desc: 'Combined Higher Secondary Level (10+2)', order: 2 },
      { catId: sscId, name: 'SSC MTS', slug: 'ssc-mts', desc: 'Multi-Tasking (Non-Technical) Staff', order: 3 },
      { catId: sscId, name: 'SSC GD', slug: 'ssc-gd', desc: 'General Duty Constable Examination', order: 4 },
      { catId: sscId, name: 'SSC CPO', slug: 'ssc-cpo', desc: 'Central Police Organization (SI in Delhi Police & CAPFs)', order: 5 },
      // Railway
      { catId: railwayId, name: 'RRB NTPC', slug: 'rrb-ntpc', desc: 'Non-Technical Popular Categories', order: 1 },
      { catId: railwayId, name: 'RRB Group D', slug: 'rrb-group-d', desc: 'Level 1 Posts Examination', order: 2 },
      { catId: railwayId, name: 'RRB ALP', slug: 'rrb-alp', desc: 'Assistant Loco Pilot', order: 3 },
      { catId: railwayId, name: 'RRB Technician', slug: 'rrb-technician', desc: 'Technician Grade I & III', order: 4 },
      // MPPSC
      { catId: mppscId, name: 'Prelims', slug: 'mppsc-prelims', desc: 'State Services Preliminary Examination', order: 1 },
      { catId: mppscId, name: 'Mains', slug: 'mppsc-mains', desc: 'State Services Main Examination', order: 2 },
      { catId: mppscId, name: 'State Forest Service', slug: 'mppsc-forest', desc: 'Forest Ranger & Assistant Conservator', order: 3 },
      // MP Police
      { catId: mpPoliceId, name: 'Constable', slug: 'mp-police-constable', desc: 'MP Police Constable Recruitment', order: 1 },
      { catId: mpPoliceId, name: 'Sub-Inspector', slug: 'mp-police-si', desc: 'MP Police Sub-Inspector (SI) Recruitment', order: 2 },
      { catId: mpPoliceId, name: 'Jail Prahari', slug: 'mp-police-jail-prahari', desc: 'Jail Department Recruitment Exam', order: 3 },
    ];

    for (const ex of examsData) {
      if (ex.catId) {
        await client.query(`
          INSERT INTO exams (category_id, name, slug, description, sort_order, enabled)
          VALUES ($1, $2, $3, $4, $5, true)
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            sort_order = EXCLUDED.sort_order;
        `, [ex.catId, ex.name, ex.slug, ex.desc, ex.order]);
      }
    }

    await client.query("COMMIT");
    console.info("Safe database migration completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  try {
    await runMigrations();
  } finally {
    await pool.end();
  }
}
