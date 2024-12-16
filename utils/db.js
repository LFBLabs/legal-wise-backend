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
        });

        const db = client.db('Paystack-subscriptions');

        // Cache the client and db connection
        cachedClient = client;
        cachedDb = db;

        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw new Error('Unable to connect to database: ' + error.message);
    }
}
