/**
 * Database Configuration & Unified Access Layer
 * Supports MySQL (mysql2/promise) and SQLite (better-sqlite3 embedded relational).
 * Preserves relational integrity, transactions, foreign keys, and indexes across both engines.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

let driver = process.env.DB_DRIVER || 'sqlite';
let pool = null;
let sqliteDb = null;

// Determine DB driver
function getDriverName() {
    return driver;
}

// Initialize SQLite connection
function initSqlite() {
    const Database = require('better-sqlite3');
    const dbDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'inventory.db');
    const db = new Database(dbPath);
    
    // Enable foreign keys and Write-Ahead Logging for concurrency safety
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    return db;
}

// Convert MySQL SQL to work with SQLite if needed (e.g. CONCAT, NOW(), DATE_SUB)
function normalizeSql(sql) {
    if (driver === 'sqlite') {
        // SQLite uses || instead of CONCAT()
        let modified = sql;
        // Replace CONCAT('%', ?, '%') with '%' || ? || '%'
        modified = modified.replace(/CONCAT\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, '($1 || $2 || $3)');
        modified = modified.replace(/CONCAT\(([^,]+),\s*([^)]+)\)/gi, '($1 || $2)');
        // Replace NOW() with CURRENT_TIMESTAMP
        modified = modified.replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP');
        // Replace CURDATE() with DATE('now')
        modified = modified.replace(/CURDATE\(\)/gi, "DATE('now')");
        // Remove FOR UPDATE lock clauses in SQLite since BEGIN IMMEDIATE locks database
        modified = modified.replace(/\s+FOR\s+UPDATE\s*$/gi, '');
        return modified;
    }
    return sql;
}

// Initialize the database connection
function setupDatabase() {
    if (driver === 'mysql') {
        try {
            const mysql = require('mysql2/promise');
            pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT, 10) || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'smart_inventory_db',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                decimalNumbers: true
            });
            console.log(`[Database] Configured for MySQL on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
        } catch (err) {
            console.warn('[Database] Failed to initialize MySQL client. Falling back to SQLite:', err.message);
            driver = 'sqlite';
            sqliteDb = initSqlite();
        }
    } else {
        sqliteDb = initSqlite();
        console.log('[Database] Configured for embedded relational SQLite with foreign keys & WAL mode.');
    }
}

setupDatabase();

/**
 * Unified Query Function
 * Returns [rows, fields] format compatible with mysql2/promise,
 * or normalized object for INSERT/UPDATE operations.
 */
async function query(sql, params = []) {
    const finalSql = normalizeSql(sql);

    if (driver === 'mysql') {
        const [rows, fields] = await pool.query(finalSql, params);
        return [rows, fields];
    } else {
        const trimmed = finalSql.trim();
        const isSelect = /^(SELECT|PRAGMA|EXPLAIN)/i.test(trimmed);

        try {
            const stmt = sqliteDb.prepare(finalSql);
            if (isSelect) {
                const rows = stmt.all(...params);
                return [rows, null];
            } else {
                const info = stmt.run(...params);
                const result = {
                    insertId: Number(info.lastInsertRowid),
                    affectedRows: info.changes,
                    changedRows: info.changes
                };
                return [result, null];
            }
        } catch (error) {
            throw error;
        }
    }
}

/**
 * Transaction Connection Interface
 * Provides atomic beginTransaction(), commit(), rollback(), and release()
 */
async function getConnection() {
    if (driver === 'mysql') {
        const connection = await pool.getConnection();
        return {
            beginTransaction: async () => connection.beginTransaction(),
            query: async (sql, params = []) => {
                const [rows, fields] = await connection.query(sql, params);
                return [rows, fields];
            },
            commit: async () => connection.commit(),
            rollback: async () => connection.rollback(),
            release: () => connection.release()
        };
    } else {
        // SQLite transaction wrapper
        let inTransaction = false;
        return {
            beginTransaction: async () => {
                sqliteDb.exec('BEGIN IMMEDIATE;');
                inTransaction = true;
            },
            query: async (sql, params = []) => {
                const finalSql = normalizeSql(sql);
                const trimmed = finalSql.trim();
                const isSelect = /^(SELECT|PRAGMA|EXPLAIN)/i.test(trimmed);
                const stmt = sqliteDb.prepare(finalSql);
                if (isSelect) {
                    const rows = stmt.all(...params);
                    return [rows, null];
                } else {
                    const info = stmt.run(...params);
                    return [{
                        insertId: Number(info.lastInsertRowid),
                        affectedRows: info.changes,
                        changedRows: info.changes
                    }, null];
                }
            },
            commit: async () => {
                if (inTransaction) {
                    sqliteDb.exec('COMMIT;');
                    inTransaction = false;
                }
            },
            rollback: async () => {
                if (inTransaction) {
                    sqliteDb.exec('ROLLBACK;');
                    inTransaction = false;
                }
            },
            release: () => {
                // In SQLite single-connection WAL, no pool release needed
            }
        };
    }
}

module.exports = {
    query,
    getConnection,
    getDriverName,
    getSqliteDb: () => sqliteDb,
    getPool: () => pool
};
