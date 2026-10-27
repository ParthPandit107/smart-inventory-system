require('dotenv').config();
const app = require('./app');
const db = require('./config/database');
const initDb = require('../database/init_db');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Initialize DB tables and seed data if not present
        await initDb();

        const server = app.listen(PORT, () => {
            console.log('================================================================');
            console.log(`  🚀 Smart Inventory Management System is running!`);
            console.log(`  🌐 URL: http://localhost:${PORT}`);
            console.log(`  📡 API Health: http://localhost:${PORT}/api/health`);
            console.log(`  🗄️  Database Driver: ${db.getDriverName()}`);
            console.log(`  👤 Default Demo Accounts:`);
            console.log(`     - Admin: admin / admin123`);
            console.log(`     - Staff: staff / staff123`);
            console.log('================================================================');
        });

        // Graceful shutdown
        const shutdown = () => {
            console.log('\n[Server] Shutting down gracefully...');
            server.close(() => {
                console.log('[Server] HTTP connections closed.');
                process.exit(0);
            });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (err) {
        console.error('[Server] Failed to start:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = startServer;
