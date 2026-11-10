import mongoose from 'mongoose';
import { config } from '../config/env';

// Disable query buffering so disconnected queries fail fast instead of hanging
mongoose.set('bufferCommands', false);

export interface DatabaseStatus {
  isConnected: boolean;
  statusText: string;
  host?: string;
  databaseName?: string;
  error?: string;
}

export let dbStatus: DatabaseStatus = {
  isConnected: false,
  statusText: 'Disconnected. MongoDB Atlas URI not configured or initializing.',
};

/**
 * Checks whether Mongoose has an active, connected session to MongoDB Atlas.
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Sanitizes a MongoDB connection URI to mask credentials for safe logging.
 */
export function sanitizeMongoUri(uri: string): string {
  if (!uri) return '';
  return uri.replace(/\/\/(.*?):(.*?)@/, '//***:***@');
}

/**
 * Validates a MongoDB Atlas connection string for structure and placeholder detection.
 */
export function validateMongoUri(uri?: string): { valid: boolean; reason?: string } {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    return { valid: false, reason: 'MONGODB_URI is empty or undefined.' };
  }

  const trimmed = uri.trim();
  if (!trimmed.startsWith('mongodb://') && !trimmed.startsWith('mongodb+srv://')) {
    return {
      valid: false,
      reason: 'Invalid protocol. MongoDB connection string must begin with "mongodb+srv://" or "mongodb://".',
    };
  }

  const placeholders = [
    'YOUR_USERNAME',
    'YOUR_PASSWORD',
    'YOUR_CLUSTER',
    'YOUR_DATABASE_NAME',
    '<username>',
    '<password>',
    '<cluster>',
    '<database>',
  ];

  for (const placeholder of placeholders) {
    if (trimmed.includes(placeholder)) {
      return {
        valid: false,
        reason: `Connection string contains unreplaced template placeholder: "${placeholder}".`,
      };
    }
  }

  return { valid: true };
}

let memoryServerInstance: any = null;

// In-flight connection promise to prevent race conditions during concurrent connection attempts
let activeConnectionPromise: Promise<boolean> | null = null;

/**
 * Production-ready MongoDB connection manager.
 * Connects to MongoDB Atlas when MONGODB_URI or a custom URI is provided,
 * or boots an embedded local MongoDB engine (via MongoMemoryServer) so that
 * all queries, aggregations, transactions, and seeding work out of the box.
 */
export async function connectToDatabase(customUri?: string): Promise<boolean> {
  let targetUri = (customUri || config.mongodbUri || '').trim();

  // If already connected to the requested URI, reuse existing connection
  if (mongoose.connection.readyState === 1 && !customUri) {
    return true;
  }

  // Prevent race conditions: return ongoing connection promise if in flight
  if (activeConnectionPromise) {
    return activeConnectionPromise;
  }

  activeConnectionPromise = (async () => {
    let isEmbedded = false;

    // If no external URI is configured, initialize embedded in-memory MongoDB
    if (!targetUri) {
      try {
        if (!memoryServerInstance) {
          console.log('⚡ Bootstrapping local MongoDB engine (MongoMemoryServer)...');
          const { MongoMemoryServer } = await import('mongodb-memory-server');
          memoryServerInstance = await MongoMemoryServer.create({
            instance: {
              dbName: 'novara_commerce',
            },
          });
        }
        targetUri = memoryServerInstance.getUri('novara_commerce');
        isEmbedded = true;
      } catch (err: any) {
        console.error('❌ Failed to boot local MongoDB engine:', err.message);
        dbStatus = {
          isConnected: false,
          statusText: 'Disconnected. Failed to start local MongoDB engine.',
          error: err.message,
        };
        return false;
      }
    } else if (customUri && memoryServerInstance) {
      // Switching from embedded to external cluster
      try {
        await memoryServerInstance.stop();
        memoryServerInstance = null;
      } catch (e) {
        console.warn('Notice stopping local memory server:', e);
      }
    }

    const validation = validateMongoUri(targetUri);
    if (!validation.valid) {
      const errorMsg = `MongoDB configuration error: ${validation.reason}`;
      console.error(`❌ [MongoDB Error] ${errorMsg}`);
      dbStatus = {
        isConnected: false,
        statusText: 'Disconnected. Invalid or missing MongoDB URI.',
        error: validation.reason,
      };
      return false;
    }

    try {
      const sanitized = sanitizeMongoUri(targetUri);
      console.log(`⏳ Connecting to MongoDB cluster at ${sanitized}...`);

      // Disconnect cleanly if already in another state
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }

      await mongoose.connect(targetUri, {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority',
      });

      const conn = mongoose.connection;
      dbStatus = {
        isConnected: true,
        statusText: isEmbedded
          ? 'Connected to Local MongoDB Engine (Ready for Full CRUD & Testing)'
          : 'Connected to MongoDB Atlas',
        host: conn.host,
        databaseName: conn.name || 'novara_commerce',
      };

      console.log(`✅ [MongoDB Connected] Host: ${conn.host}, Database: ${conn.name}`);
      return true;
    } catch (err: any) {
      console.error('❌ [MongoDB Connection Failed]:', err.message);
      dbStatus = {
        isConnected: false,
        statusText: 'Failed to connect to MongoDB cluster',
        error: err.message,
      };
      return false;
    } finally {
      activeConnectionPromise = null;
    }
  })();

  return activeConnectionPromise;
}

/**
 * Gracefully terminates MongoDB connection pool and stops any embedded local engine on application shutdown.
 */
export async function disconnectFromDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    console.log('🔌 Closing MongoDB connection pool...');
    await mongoose.connection.close();
    dbStatus = {
      isConnected: false,
      statusText: 'Disconnected from MongoDB',
    };
    console.log('✅ MongoDB connection closed.');
  }

  if (memoryServerInstance) {
    console.log('🔌 Stopping local MongoDB engine...');
    await memoryServerInstance.stop();
    memoryServerInstance = null;
    console.log('✅ Local MongoDB engine stopped.');
  }
}

// Global Mongoose connection lifecycle listeners
mongoose.connection.on('connected', () => {
  dbStatus.isConnected = true;
  dbStatus.statusText = 'Connected to MongoDB Atlas';
  dbStatus.host = mongoose.connection.host;
  dbStatus.databaseName = mongoose.connection.name;
  console.log(`📡 [MongoDB Event: connected] Host: ${mongoose.connection.host}, DB: ${mongoose.connection.name}`);
});

mongoose.connection.on('disconnected', () => {
  dbStatus.isConnected = false;
  dbStatus.statusText = 'Disconnected from MongoDB Atlas';
  console.warn('⚠️ [MongoDB Event: disconnected] Lost connection to MongoDB Atlas.');
});

mongoose.connection.on('reconnected', () => {
  dbStatus.isConnected = true;
  dbStatus.statusText = 'Connected to MongoDB Atlas';
  console.log('🔄 [MongoDB Event: reconnected] Reconnected to MongoDB Atlas cluster.');
});

mongoose.connection.on('error', (err) => {
  dbStatus.isConnected = false;
  dbStatus.error = err.message;
  console.error('❌ [MongoDB Event: error]:', err.message);
});
