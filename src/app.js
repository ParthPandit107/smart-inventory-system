const express = require('express');
const cors = require('cors');
const path = require('path');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Static Frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Mount API routes under /api
app.use('/api', apiRoutes);

// Fallback for SPA routing & 404 handler
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(__dirname, '../public/index.html'));
    }
    if (req.path.startsWith('/api')) {
        return res.status(404).json({
            success: false,
            message: `Endpoint '${req.method} ${req.path}' not found on this server.`
        });
    }
    next();
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
