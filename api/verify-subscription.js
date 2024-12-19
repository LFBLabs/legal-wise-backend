import { connectToDatabase } from '../utils/db';

export const config = {
    runtime: 'edge',
    regions: ['fra1'], // Deploy to Frankfurt for lower latency
};

export default async function handler(req) {
    console.log('Received request headers:', req.headers);
    console.log('Environment variables:', {
        hasApiKey: !!process.env.API_KEY,
        apiKeyLength: process.env.API_KEY ? process.env.API_KEY.length : 0
    });

    // Handle CORS preflight
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
        'Access-Control-Allow-Credentials': 'true',
    };

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return new Response(null, { 
            status: 204,
            headers 
        });
    }

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }), 
            { 
                status: 405,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = process.env.API_KEY;
    
    console.log('API Key validation:', {
        receivedKey: apiKey,
        expectedKey: expectedApiKey,
        headerKeys: Array.from(req.headers.keys()),
        match: apiKey === expectedApiKey
    });
    
    if (!apiKey || apiKey !== expectedApiKey) {
        console.log('Invalid or missing API key');
        return new Response(
            JSON.stringify({ 
                error: 'Unauthorized',
                message: 'Invalid or missing API key',
                debug: {
                    hasApiKey: !!apiKey,
                    keyMatch: apiKey === expectedApiKey
                }
            }), 
            { 
                status: 401,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    try {
        const body = await req.json();
        const { email } = body;
        
        if (!email) {
            console.log('No email provided in request');
            return new Response(
                JSON.stringify({ error: 'Email is required' }), 
                { 
                    status: 400,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    }
                }
            );
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
            return new Response(
                JSON.stringify({ active: false }), 
                { 
                    status: 200,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    }
                }
            );
        }

        console.log('Active subscription found, returning details');
        return new Response(
            JSON.stringify({
                active: true,
                plan: subscription.plan,
                reference: subscription.reference,
                expiryDate: subscription.expiryDate
            }), 
            { 
                status: 200,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        console.error('Error in verify-subscription:', error);
        
        // Handle specific error types
        if (error.message === 'Database operation timed out') {
            return new Response(
                JSON.stringify({ 
                    error: 'Gateway Timeout', 
                    message: 'Database operation timed out'
                }), 
                { 
                    status: 504,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    }
                }
            );
        }

        return new Response(
            JSON.stringify({ 
                error: 'Internal server error', 
                details: error.message
            }), 
            { 
                status: 500,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                }
            }
        );
    }
}
