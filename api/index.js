require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('../routes/auth');
const clientRoutes = require('../routes/clients');
const invoiceRoutes = require('../routes/invoices');
const tenantRoutes = require('../routes/tenant');

const app = express();

// Global Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for public routes
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to public routes
app.use('/api/auth', publicApiLimiter);
app.use('/api/invoices/pay', publicApiLimiter);

// Logging for development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Route Handlers
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/tenant', tenantRoutes);

// Health check route
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'PayControl API', version: '2.0.0', timestamp: new Date().toISOString() });
});

// 404 Not Found Handler
app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error('Erro interno:', err);
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Erro interno do servidor' });
  } else {
    res.status(500).json({ error: 'Erro interno do servidor', details: err.message, stack: err.stack });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 PayControl API rodando na porta ${PORT}`));

module.exports = app;
