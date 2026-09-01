// Applique une migration Prisma via le driver `pg` (contournement : le moteur
// de migration Rust de Prisma ne joint pas Neon depuis cet environnement,
// alors que le driver `pg` de l'application, lui, y parvient).
//
// Usage : node prisma/apply-migration.mjs <nom_du_dossier_de_migration>
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import 'dotenv/config';
import pg from 'pg';

const name = process.argv[2];
if (!name) {
  console.error('Usage: node prisma/apply-migration.mjs <migration-folder-name>');
  process.exit(1);
}

const sqlPath = path.join('prisma', 'migrations', name, 'migration.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const run = async () => {
  await client.connect();
  console.log('Connecté à la base.');

  const already = await client
    .query('SELECT 1 FROM _prisma_migrations WHERE migration_name = $1', [name])
    .catch(() => ({ rows: [] }));
  if (already.rows.length) {
    console.log('Migration déjà enregistrée, rien à faire.');
    return;
  }

  try {
    await client.query('BEGIN');
    await client.query(sql);
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    await client.query(
      `INSERT INTO _prisma_migrations
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1, $2, now(), $3, NULL, NULL, now(), 1)`,
      [crypto.randomUUID(), checksum, name],
    );
    await client.query('COMMIT');
    console.log(`Migration "${name}" appliquée et enregistrée.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Échec, rollback effectué :', error.message);
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
