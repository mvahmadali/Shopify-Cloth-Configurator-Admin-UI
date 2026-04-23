import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import { randomUUID } from 'node:crypto';

import productsRouter from './routes/products.js';
import uploadRouter from './routes/upload.js';
import { errorHandler } from './middleware/errorHandler.js';
import { models } from './db/models.js';
import { buildOrderProperties } from './shopify/orderDetailsMock.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Shopify Configuration
const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Logging utility
const log = (level, event, details = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details
  };

  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
};

if (!SHOP || !TOKEN) {
  throw new Error('Missing SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN in environment variables.');
}

// Middleware
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173,https://shopify-suit-configurator.vercel.app')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const isDevLocalOrigin = (origin) => {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
};

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (no Origin header), configured origins, and local dev hosts.
    if (!origin || allowedOrigins.includes(origin) || isDevLocalOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Request ID middleware
app.use((req, _res, next) => {
  req.requestId = randomUUID();
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  log('info', 'request_received', {
    requestId: req.requestId,
    method: req.method,
    path: req.path
  });

  res.on('finish', () => {
    log('info', 'request_completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start
    });
  });

  next();
});

// MongoDB Connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    const conn = await mongoose.connect(mongoURI);
    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Optional: Seed data on first run (commented out so users create products manually)
    // await models.seedData();

    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Routes
app.use('/api/admin/products', productsRouter);
app.use('/api/admin/upload-model', uploadRouter);

// Shopify Order Creation Endpoint
app.post('/create-order', async (req, res) => {
  try {
    const incomingTotal = Number(req.body?.totalPrice ?? req.body?.price);
    const configuration = req.body?.configuration || {};
    const fabric = configuration.fabric || {};
    const monogram = configuration.monogram || {};
    const fabricPrice = Number(fabric.fabricPrice);
    const safeFabricPrice = Number.isFinite(fabricPrice) && fabricPrice > 0 ? fabricPrice : 1500;
    const finalPrice = Number.isFinite(incomingTotal) && incomingTotal > 0 ? incomingTotal : safeFabricPrice + 300;
    const orderProperties = buildOrderProperties({
      configuration,
      fabric,
      monogram,
      safeFabricPrice,
      finalPrice
    });

    log('info', 'draft_order_create_started', {
      requestId: req.requestId,
      configurationSummary: {
        id: configuration.id || 'n/a',
        type: configuration.type || 'Three piece',
        fit: configuration.fit || 'Slim',
        style: configuration.style || 'Single breast',
        fabricBrand: fabric.brand || 'Outfitters',
        fabricPattern: fabric.pattern || 'Solid',
        fabricPrice: safeFabricPrice,
        price: finalPrice
      }
    });

    const draftOrderPayload = {
      draft_order: {
        line_items: [
          {
            title: 'Custom Suit',
            price: finalPrice.toFixed(2),
            quantity: 1,
            properties: orderProperties
          }
        ],
        note: 'Custom Suit Order',
        tags: 'custom-configurator'
      }
    };

    const response = await axios.post(
      `https://${SHOP}/admin/api/2023-10/draft_orders.json`,
      draftOrderPayload,
      {
        headers: {
          'X-Shopify-Access-Token': TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    const draftOrderId = response.data?.draft_order?.id;
    const checkoutUrl = response.data?.draft_order?.invoice_url;

    if (!checkoutUrl) {
      log('error', 'draft_order_missing_checkout_url', {
        requestId: req.requestId,
        draftOrderId: draftOrderId || 'n/a'
      });
      return res.status(500).json({ error: 'Draft order created but checkout URL missing.' });
    }

    log('info', 'draft_order_create_succeeded', {
      requestId: req.requestId,
      draftOrderId,
      price: finalPrice,
      checkoutUrl
    });

    return res.json({ checkoutUrl });
  } catch (error) {
    log('error', 'draft_order_create_failed', {
      requestId: req.requestId,
      status: error.response?.status || 500,
      message: error.message,
      shopifyError: error.response?.data || null
    });
    return res.status(500).json({ error: 'Failed to create order' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState });
});

// Error handling
app.use(errorHandler);

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
