export const config = {
    api: {
        bodyParser: true,
    },
    regions: ['fra1'], // Deploy to Frankfurt for lower latency
};

export default async function handler(req, res) {
    // Log all environment variables (except sensitive ones)
    console.log('Environment variables:', {
        hasMongoDb: !!process.env.MONGODB_URI,
        hasPaystackKey: !!process.env.PAYSTACK_SECRET_KEY,
        hasApiKey: !!process.env.API_KEY,
        apiKeyValue: process.env.API_KEY,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
    });

    console.log('Received request headers:', JSON.stringify(req.headers, null, 2));
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, x-api-key'
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

    try {
        const { email, plan, amount } = req.body;

        if (!email || !plan || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Initialize payment with Paystack
        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                amount,
                plan,
                callback_url: 'https://legal-wise-backend-grkgp18b7-pieterses-projects.vercel.app/api/payment-callback'
            })
        });

        const paystackData = await paystackResponse.json();

        if (!paystackResponse.ok) {
            console.error('Paystack error:', paystackData);
            return res.status(paystackResponse.status).json({ 
                error: 'Failed to initialize payment',
                details: paystackData.message
            });
        }

        return res.status(200).json(paystackData);
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
}
