import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
}

const MONGODB_URI = process.env.MONGODB_URI;
let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
    // If we have a cached connection, use it
    if (cachedClient && cachedDb) {
        return cachedDb;
    }

    try {
        // If no connection, create a new one
        const client = await MongoClient.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            connectTimeoutMS: 5000, // 5 seconds
            socketTimeoutMS: 5000,
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10,
            minPoolSize: 5,
            tls: true,
            tlsAllowInvalidCertificates: true // Allow self-signed certificates
        });

        const db = client.db('Paystack-subscriptions');

        // Cache the client and db connection
        cachedClient = client;
        cachedDb = db;

        // Test the connection
        await db.command({ ping: 1 });
        console.log('Database connected successfully');

        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        cachedClient = null;
        cachedDb = null;
        throw new Error('Unable to connect to database: ' + error.message);
    }
}
