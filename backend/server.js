require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');

const connectDB = require('./src/config/db');
const logger = require('./src/config/logger');
const swaggerSpec = require('./src/config/swagger');

// Import routes
const authRoutes = require('./src/modules/auth/auth.routes');
const analyzeRoutes = require('./src/routes/analyze');
const chatRoutes = require('./src/routes/chat');
const whatifRoutes = require('./src/routes/whatif');
const translationRoutes = require('./src/routes/translation');

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Upload directory configuration (serverless safe)
const { uploadsDir, isServerless } = require('./src/config/paths');

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Let React handle SPA resource loading
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Express limits and body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Global HTTP request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Rate limiting (100 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', apiLimiter);

// Serve uploads folder static files
app.use('/uploads', express.static(uploadsDir));

// Swagger Documentation Route
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/whatif', whatifRoutes);
app.use('/api/translation', translationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    aiProviders: {
      gemini: !!process.env.GEMINI_API_KEY,
      openai: !!process.env.OPENAI_API_KEY
    }
  });
});

// Serve frontend static assets (SPA routing support)
const frontendDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
} else {
  // If Vite distribution is not built yet, fallback response
  app.get('*', (req, res) => {
    res.json({
      message: 'Legal Docs Demystifier API is active. Web UI frontend requires "npm run build" inside /frontend.',
      docs: '/api/docs',
      health: '/api/health'
    });
  });
}

// Global error handler middleware
app.use((err, req, res, next) => {
  logger.error(`Server error: ${err.message} \nStack: ${err.stack}`);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

if (!isServerless && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n🚀 Legal Docs Demystifier Backend`);
    console.log(`   Server running at http://localhost:${PORT}`);
    console.log(`   API Docs: http://localhost:${PORT}/api/docs`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
    console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Available' : '⚠️  Not Configured (using GPT-4o fallback or offline model)'}`);
    console.log(`   OpenAI AI: ${process.env.OPENAI_API_KEY ? '✅ Available' : '❌ Not Configured'}`);
    console.log(`   Frontend served from: ${fs.existsSync(frontendDir) ? '✅ /frontend/dist' : '⚠️  Not built (run npm run build in frontend)'}\n`);
  });
}

module.exports = app;
