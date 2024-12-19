export const config = {
    runtime: 'edge',
    regions: ['fra1'], // Deploy to Frankfurt for lower latency
};

export default async function handler(req, res) {
    // Handle CORS preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate API key
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.API_KEY;
    
    console.log('Received API key:', apiKey);
    console.log('Expected API key:', expectedApiKey);
    
    if (!apiKey || apiKey !== expectedApiKey) {
        console.log('Invalid or missing API key');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { email, plan } = req.body;
        console.log('Received payment request:', { email, plan });

        if (!email || !plan) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!process.env.PAYSTACK_SECRET_KEY) {
            console.error('Paystack secret key is missing');
            return res.status(500).json({ error: 'Payment service configuration error' });
        }

        // Calculate amount in kobo (smallest currency unit)
        const amount = plan === 'monthly' ? 9000 : 91800; // R90 = 9000 kobo, R918 = 91800 kobo

        // Initialize transaction with test values
        const paymentData = {
            email,
            amount,
            currency: 'ZAR',
            callback_url: 'https://legal-wise-backend.vercel.app/api/payment-callback',
            channels: ['card'],
            metadata: {
                custom_fields: [
                    {
                        display_name: "Plan Type",
                        variable_name: "plan_type",
                        value: plan
                    }
                ]
            }
        };

        console.log('Initializing Paystack payment:', paymentData);

        const initResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        const responseText = await initResponse.text();
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse Paystack response:', responseText);
            return res.status(500).json({ error: 'Invalid response from payment provider' });
        }

        if (!initResponse.ok) {
            console.error('Paystack error response:', responseData);
            return res.status(initResponse.status).json({
                error: 'Payment initialization failed',
                details: responseData
            });
        }

        console.log('Paystack success response:', responseData);
        return res.status(200).json(responseData);
    } catch (error) {
        console.error('Error in payment initialization:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
