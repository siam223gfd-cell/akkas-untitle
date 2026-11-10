import mongoose from 'mongoose';
import { Router, Request, Response } from 'express';
import {
  dbStatus,
  connectToDatabase,
  isDatabaseConnected,
  validateMongoUri,
  sanitizeMongoUri,
} from '../../database/connection';
import { ProductModel } from '../../database/models/Product';
import { OrderModel } from '../../database/models/Order';
import { UserModel } from '../../database/models/User';
import { CategoryModel } from '../../database/models/Category';
import { seedInitialDatabase } from '../../database/seed';

export const healthRouter = Router();

// GET /api/health - Diagnostic endpoint reporting service & Atlas connection status
healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    let productCount = 0;
    let orderCount = 0;
    let userCount = 0;
    let categoryCount = 0;

    const connected = isDatabaseConnected();

    if (connected) {
      try {
        [productCount, orderCount, userCount, categoryCount] = await Promise.all([
          ProductModel.countDocuments(),
          OrderModel.countDocuments(),
          UserModel.countDocuments(),
          CategoryModel.countDocuments(),
        ]);
      } catch (err) {
        console.warn('Health check query failed:', err);
      }
    }

    res.json({
      status: connected ? 'healthy' : 'database_disconnected',
      service: 'Novara Commerce API',
      timestamp: new Date().toISOString(),
      database: {
        isConnected: connected,
        statusText: dbStatus.statusText,
        host: dbStatus.host,
        databaseName: dbStatus.databaseName,
        error: dbStatus.error,
      },
      metrics: {
        totalProducts: productCount,
        totalOrders: orderCount,
        totalUsers: userCount,
        totalCategories: categoryCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, database: dbStatus });
  }
});

// GET /api/health/diagnostics - Comprehensive real-time Atlas diagnostics
healthRouter.get('/diagnostics', async (req: Request, res: Response) => {
  try {
    const isConnected = isDatabaseConnected();
    const readyState = mongoose.connection.readyState;
    const readyStateMap: Record<number, string> = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting',
    };

    if (!isConnected || !mongoose.connection.db) {
      return res.json({
        success: false,
        status: 'disconnected',
        database: {
          isConnected: false,
          readyStateText: readyStateMap[readyState] || 'Unknown',
          statusText: dbStatus.statusText,
          error: dbStatus.error || 'MongoDB Atlas connection is not active.',
        },
        diagnostics: null,
      });
    }

    // 1. Measure real ping latency via admin().ping()
    const pingStart = Date.now();
    await mongoose.connection.db.admin().ping();
    const pingLatencyMs = Date.now() - pingStart;

    // 2. Query collections and exact document counts
    const collectionsRaw = await mongoose.connection.db.listCollections().toArray();
    const collections = await Promise.all(
      collectionsRaw
        .filter((col) => !col.name.startsWith('system.'))
        .map(async (col) => {
          try {
            const count = await mongoose.connection.db!.collection(col.name).countDocuments();
            return {
              name: col.name,
              documentCount: count,
              type: col.type || 'collection',
            };
          } catch {
            return { name: col.name, documentCount: 0, type: 'collection' };
          }
        })
    );

    // 3. Perform a safe read/write probe
    let probeSuccess = false;
    let probeLatencyMs = 0;
    try {
      const probeStart = Date.now();
      const probeCol = mongoose.connection.db.collection('_diagnostic_probes');
      const probeId = `probe_${Date.now()}`;
      await probeCol.insertOne({ _id: probeId as any, timestamp: new Date() });
      await probeCol.deleteOne({ _id: probeId as any });
      probeLatencyMs = Date.now() - probeStart;
      probeSuccess = true;
    } catch (e: any) {
      probeSuccess = false;
    }

    // 4. Server build info (MongoDB engine version)
    let engineVersion = 'Atlas Managed';
    try {
      const buildInfo = await mongoose.connection.db.admin().buildInfo();
      if (buildInfo?.version) {
        engineVersion = `MongoDB v${buildInfo.version}`;
      }
    } catch {}

    const totalDocuments = collections.reduce((acc, c) => acc + c.documentCount, 0);

    res.json({
      success: true,
      status: 'connected',
      timestamp: new Date().toISOString(),
      database: {
        isConnected: true,
        databaseName: mongoose.connection.name || dbStatus.databaseName || 'novara_commerce',
        host: dbStatus.host || mongoose.connection.host || 'MongoDB Atlas Cluster',
        readyState: readyState,
        readyStateText: readyStateMap[readyState],
        engineVersion,
      },
      diagnostics: {
        pingLatencyMs,
        probeSuccess,
        probeLatencyMs,
        collectionsCount: collections.length,
        totalDocuments,
        collections: collections.sort((a, b) => b.documentCount - a.documentCount),
        serverUptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      status: 'error',
      message: err.message || 'Diagnostic inspection failed',
      database: {
        isConnected: isDatabaseConnected(),
        error: err.message,
      },
    });
  }
});

// POST /api/health/connect - Connect or reconnect to MongoDB Atlas with input validation
healthRouter.post('/connect', async (req: Request, res: Response) => {
  try {
    const { uri, runSeed } = req.body;

    const validation = validateMongoUri(uri);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.reason || 'Invalid MongoDB Atlas connection string.',
        database: dbStatus,
      });
    }

    const success = await connectToDatabase(uri);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: dbStatus.error || 'Failed to connect to MongoDB Atlas cluster. Check connection string, user credentials, and network IP allowlist (0.0.0.0/0).',
        database: dbStatus,
      });
    }

    let seedResult = null;
    if (runSeed) {
      seedResult = await seedInitialDatabase();
    }

    res.json({
      success: true,
      message: 'Successfully connected to MongoDB Atlas!',
      database: dbStatus,
      seedResult,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/health/seed - Trigger database seeding on connected cluster
healthRouter.post('/seed', async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Cannot seed: MongoDB Atlas is not connected. A valid MongoDB Atlas cluster connection is required.',
        database: dbStatus,
      });
    }

    const result = await seedInitialDatabase();
    res.json({
      success: true,
      message: 'Database seeded successfully with default catalog, categories, coupons, and staff users.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
