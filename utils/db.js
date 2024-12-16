import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
}

// Add database name to URI if not present
const MONGODB_URI = process.env.MONGODB_URI.includes('/Paystack-subscriptions?') ? 
    process.env.MONGODB_URI : 
    process.env.MONGODB_URI.replace('/?', '/Paystack-subscriptions?');

// Log the URI format (without sensitive info)
const redactedUri = MONGODB_URI.replace(/\/\/[^@]+@/, '//[REDACTED]@');
console.log('MongoDB URI format:', redactedUri);

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
    // If we have a cached connection, use it
    if (cachedClient && cachedDb) {
        return cachedDb;
    }

    try {
        console.log('Attempting to connect to MongoDB...');
        
        // Connect with minimal options
        const client = await MongoClient.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
            socketTimeoutMS: 5000
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
