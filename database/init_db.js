/**
 * Database Initialization and Seed Runner Script
 * Usage: node database/init_db.js [--force]
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function initialize() {
    const driver = db.getDriverName();
    console.log(`[InitDB] Starting database initialization using driver: ${driver}...`);

    try {
        if (driver === 'sqlite') {
            const sqliteDb = db.getSqliteDb();
            const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sqlite.sql'), 'utf-8');
            sqliteDb.exec(schemaSql);
            console.log('[InitDB] Schema created successfully.');

            // Check if users table already has data
            const userCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
            if (userCount === 0 || process.argv.includes('--force')) {
                console.log('[InitDB] Seeding database with realistic records...');
                const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
                sqliteDb.exec(seedSql);
                console.log('[InitDB] Seed data loaded successfully.');
            } else {
                console.log(`[InitDB] Database already seeded (${userCount} users found). Skipping seed.`);
            }
        } else if (driver === 'mysql') {
            const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.mysql.sql'), 'utf-8');
            const statements = schemaSql.split(/;\s*$/m).filter(s => s.trim().length > 0);
            for (const statement of statements) {
                await db.query(statement);
            }
            console.log('[InitDB] MySQL Schema created successfully.');

            const [rows] = await db.query('SELECT COUNT(*) as count FROM users');
            const userCount = rows[0]?.count || 0;
            if (userCount === 0 || process.argv.includes('--force')) {
                console.log('[InitDB] Seeding MySQL database...');
                const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
                const seedStatements = seedSql.split(/;\s*$/m).filter(s => s.trim().length > 0);
                for (const statement of seedStatements) {
                    await db.query(statement);
                }
                console.log('[InitDB] Seed data loaded successfully into MySQL.');
            } else {
                console.log(`[InitDB] MySQL database already has data (${userCount} users found). Skipping seed.`);
            }
        }

        console.log('[InitDB] Database ready for production/demo operations.');
    } catch (error) {
        console.error('[InitDB] Error initializing database:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    initialize().then(() => process.exit(0));
}

module.exports = initialize;
