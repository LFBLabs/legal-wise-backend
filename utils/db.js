import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
}

// Parse and reconstruct the URI with updated options
const uri = new URL(process.env.MONGODB_URI);
uri.searchParams.set('tls', 'true');
uri.searchParams.set('tlsAllowInvalidCertificates', 'true');
uri.searchParams.set('retryWrites', 'true');
uri.searchParams.set('w', 'majority');

const MONGODB_URI = uri.toString();
let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
    // If we have a cached connection, use it
    if (cachedClient && cachedDb) {
        return cachedDb;
    }

    try {
        console.log('Attempting to connect to MongoDB...');
        
        // If no connection, create a new one
        const client = await MongoClient.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            connectTimeoutMS: 10000, // 10 seconds
            socketTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: 10,
            minPoolSize: 5
        });

        console.log('MongoDB client connected');

        const db = client.db('Paystack-subscriptions');
        console.log('Database selected');

        // Cache the client and db connection
        cachedClient = client;
        cachedDb = db;

        // Test the connection
        await db.command({ ping: 1 });
        console.log('Database connection verified with ping');

        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        if (error.name === 'MongoServerSelectionError') {
            console.error('Server selection timed out. Current topology:', error.topology);
        }
        cachedClient = null;
        cachedDb = null;
        throw new Error('Unable to connect to database: ' + error.message);
    }
}
