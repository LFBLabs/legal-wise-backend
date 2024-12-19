import mongoose from 'mongoose';

let cachedDb = null;

export async function connectToDatabase() {
    if (cachedDb) {
        console.log('Using cached database connection');
        return cachedDb;
    }

    console.log('Creating new database connection');
    
    try {
        const db = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        cachedDb = db.connection.db;
        return cachedDb;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}
