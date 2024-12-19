import { connectToDatabase } from '../utils/db';

export default async function handler(req, res) {
    console.log('Received request headers:', req.headers);
    console.log('Environment variables:', {
        hasApiKey: !!process.env.API_KEY,
        apiKeyLength: process.env.API_KEY ? process.env.API_KEY.length : 0
    });

    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key'
    );

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate API key - check header in a case-insensitive way
    const apiKeyHeader = Object.keys(req.headers).find(key => key.toLowerCase() === 'x-api-key');
    const apiKey = apiKeyHeader ? req.headers[apiKeyHeader] : null;
    const expectedApiKey = process.env.API_KEY;
    
    console.log('API Key validation:', {
        receivedKey: apiKey,
        expectedKey: expectedApiKey,
        headerKeys: Object.keys(req.headers),
        foundHeader: apiKeyHeader,
        match: apiKey === expectedApiKey
    });
    
    if (!apiKey || apiKey !== expectedApiKey) {
        console.log('Invalid or missing API key');
        return res.status(401).json({ 
            error: 'Unauthorized',
            message: 'Invalid or missing API key',
            debug: {
                hasApiKey: !!apiKey,
                keyMatch: apiKey === expectedApiKey
            }
        });
    }

    console.log('Starting subscription verification...');

    try {
        const { email } = req.body;
        
        if (!email) {
            console.log('No email provided in request');
            return res.status(400).json({ error: 'Email is required' });
        }

        console.log('Verifying subscription for email:', email);

        // Add timeout to database operations
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database operation timed out')), 8000)
        );

        const dbOperation = async () => {
            console.log('Connecting to database...');
            const db = await connectToDatabase();

            console.log('Querying subscriptions collection...');
            const subscription = await db.collection('subscriptions').findOne({
                email: email.toLowerCase(),
                status: 'active',
                expiryDate: { $gt: new Date() }
            });

            console.log('Subscription query result:', subscription);
            return subscription;
        };

        // Race between timeout and database operation
        const subscription = await Promise.race([dbOperation(), timeoutPromise]);

        if (!subscription) {
            console.log('No active subscription found');
            return res.json({ active: false });
        }

        console.log('Active subscription found, returning details');
        return res.json({
            active: true,
            plan: subscription.plan,
            reference: subscription.reference,
            expiryDate: subscription.expiryDate
        });
    } catch (error) {
        console.error('Error in verify-subscription:', error);
        
        // Handle specific error types
        if (error.message === 'Database operation timed out') {
            return res.status(504).json({ 
                error: 'Gateway Timeout', 
                message: 'Database operation timed out'
            });
        }

        return res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message,
            stack: error.stack 
        });
    }
}
