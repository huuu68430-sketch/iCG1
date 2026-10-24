import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SOURCE_ENV = 'SOURCE_SUPABASE_DATABASE_URL';
const TARGET_ENV = 'TARGET_SUPABASE_DATABASE_URL';

function fail(message) {
  console.error(`[Supabase migration] ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function parseConnectionString(value, envName) {
  let connectionString = value.trim().replace(/^['"`]|['"`]$/g, '');
  const uriMatch = connectionString.match(/(?:jdbc:)?(?:postgresql|postgres):\/\/[^\s'"]+/i);
  if (uriMatch) {
    connectionString = uriMatch[0].replace(/^jdbc:/i, '');
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    fail(`${envName} is missing or is not a valid PostgreSQL connection URL.`);
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    fail(`${envName} must use the PostgreSQL protocol.`);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (!url.hostname || !database || !username || !password) {
    fail(`${envName} must include a host, database, username, and password.`);
  }

  return {
    identity: [url.hostname, url.port || '5432', username, database].join('|'),
    database,
    pgEnv: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGUSER: username,
      PGPASSWORD: password,
      PGDATABASE: database,
      PGSSLMODE: url.searchParams.get('sslmode') || 'require',
      PGAPPNAME: 'icg1-supabase-data-migration',
    },
  };
}

function run(command, args, env, options = {}) {
  const result = spawnSync(command, args, {
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });

  if (result.error) {
    fail(`Could not start ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || '').trim().slice(-2000);
    fail(`${command} failed${detail ? `: ${detail}` : '.'}`);
  }
  return result.stdout || '';
}

const nonExtensionRelationsSql = `
  SELECT count(*)::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm')
    AND NOT c.relispartition
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass
        AND d.objid = c.oid
        AND d.deptype = 'e'
    );
`;

function scalar(connection, sql) {
  return run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], connection.pgEnv)
    .trim()
    .split('\n')
    .at(-1);
}

function listPublicTables(connection) {
  return run(
    'psql',
    [
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'p')
         AND NOT c.relispartition
         AND NOT EXISTS (
           SELECT 1 FROM pg_depend d
           WHERE d.classid = 'pg_class'::regclass
             AND d.objid = c.oid
             AND d.deptype = 'e'
         )
       ORDER BY c.relname;`,
    ],
    connection.pgEnv,
  )
    .split('\n')
    .map((table) => table.trim())
    .filter(Boolean);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function getTableCounts(connection, tables) {
  return tables.map((table) => {
    const count = scalar(
      connection,
      `SELECT count(*)::text FROM public.${quoteIdentifier(table)};`,
    );
    return [table, count];
  });
}

async function main() {
  const sourceValue = process.env[SOURCE_ENV];
  const targetValue = process.env[TARGET_ENV];
  if (!sourceValue || !targetValue) {
    fail(`Add ${SOURCE_ENV} and ${TARGET_ENV} through Replit Secrets before running this migration.`);
  }

  const source = parseConnectionString(sourceValue, SOURCE_ENV);
  const target = parseConnectionString(targetValue, TARGET_ENV);
  if (source.identity === target.identity) {
    fail('The source and target point to the same database. No changes were made.');
  }

  const sourceRelations = Number(scalar(source, nonExtensionRelationsSql));
  if (!Number.isFinite(sourceRelations) || sourceRelations === 0) {
    fail('The source has no public application tables to migrate.');
  }

  const targetRelations = Number(scalar(target, nonExtensionRelationsSql));
  if (!Number.isFinite(targetRelations)) {
    fail('Could not safely inspect the target database.');
  }
  if (targetRelations !== 0) {
    fail(`The target already has ${targetRelations} public application relation(s). It was left unchanged.`);
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'icg1-supabase-migration-'));
  const dumpPath = path.join(tempDir, 'public.dump');
  const tocPath = path.join(tempDir, 'restore.list');

  try {
    run(
      'pg_dump',
      [
        '--format=custom',
        '--schema=public',
        '--no-owner',
        '--file',
        dumpPath,
      ],
      source.pgEnv,
    );

    const toc = run('pg_restore', ['--list', dumpPath], source.pgEnv);
    const restoreList = toc
      .split('\n')
      .filter((line) => !/^\d+;\s+\d+\s+\d+\s+SCHEMA\s+-\s+public(?:\s|$)/.test(line))
      .join('\n');
    await writeFile(tocPath, restoreList, { mode: 0o600 });

    run(
      'pg_restore',
      [
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        '--use-list',
        tocPath,
        '--dbname',
        target.database,
        dumpPath,
      ],
      target.pgEnv,
    );

    const tables = listPublicTables(source);
    const sourceCounts = getTableCounts(source, tables);
    const targetCounts = getTableCounts(target, tables);
    const targetByTable = new Map(targetCounts);
    const mismatches = sourceCounts.filter(([table, count]) => targetByTable.get(table) !== count);

    if (mismatches.length) {
      fail(`Row-count verification failed for ${mismatches.map(([table]) => table).join(', ')}.`);
    }

    console.log(`Migration complete: ${tables.length} public tables and their rows were copied.`);
    for (const [table, count] of sourceCounts) {
      console.log(`- ${table}: ${count} rows`);
    }
    console.log('The source database was not modified.');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  if (!process.exitCode) {
    console.error(`[Supabase migration] ${error.message}`);
    process.exitCode = 1;
  }
});
