export const config = {
    runtime: 'edge',
    regions: ['fra1'], // Deploy to Frankfurt for lower latency
};

export default async function handler(req) {
    console.log('Received request headers:', req.headers);
    
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
        const { email, plan, amount } = body;

        if (!email || !plan || !amount) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }), 
                { 
                    status: 400,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    }
                }
            );
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
            return new Response(
                JSON.stringify({ 
                    error: 'Failed to initialize payment',
                    details: paystackData.message
                }), 
                { 
                    status: paystackResponse.status,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    }
                }
            );
        }

        return new Response(
            JSON.stringify(paystackData), 
            { 
                status: 200,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ 
                error: 'Internal server error',
                message: error.message
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
