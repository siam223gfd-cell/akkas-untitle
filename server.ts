import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { config, validateEnvironment } from './server/config/env';
import { createExpressApp } from './server/app';
import { connectToDatabase, disconnectFromDatabase } from './server/database/connection';
import { seedDatabaseIfEmpty } from './server/database/seed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Validate environment configuration for production readiness
  validateEnvironment();

  const app = createExpressApp();
  const PORT = config.port;
  const isProd = config.env === 'production';

  // Connect to MongoDB (Atlas or embedded local engine)
  const connected = await connectToDatabase();
  if (connected) {
    await seedDatabaseIfEmpty();
  } else if (isProd) {
    throw new Error(
      'Failed to connect to MongoDB cluster in production. ' +
      'Process cannot start without verified database connectivity.'
    );
  }

  if (!isProd) {
    // Development mode: mount Vite dev middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 [Novara Commerce Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`📡 [API Health] http://localhost:${PORT}/api/health\n`);
  });

  // Graceful shutdown lifecycle management
  const handleShutdown = async (signal: string) => {
    console.log(`\n🛑 [${signal}] Initiating graceful shutdown...`);
    server.close(async () => {
      await disconnectFromDatabase();
      console.log('✅ Server and database connections terminated safely.');
      process.exit(0);
    });

    // Force exit if shutdown hangs beyond 10 seconds
    setTimeout(() => {
      console.error('⚠️ Shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
