import { connectToDatabase } from '../utils/db';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, plan } = req.body;
    console.log('Received request with:', { email, plan });

    if (!email || !plan) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Get plan code based on plan type
        const planCode = plan === 'monthly' ? 'PLN_0n02r3xe590nhm5' : 'PLN_ghrxb3r46xgoip0';
        console.log('Using plan code:', planCode, 'for plan type:', plan);

        const paymentData = {
            email,
            plan: planCode,
            callback_url: 'https://legal-wise-backend.vercel.app/api/payment-callback',
            metadata: {
                email,
                plan,
                product: 'Legal Wise Summarizer'
            }
        };

        console.log('Initializing subscription with data:', JSON.stringify(paymentData, null, 2));

        // Initialize subscription with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        const data = await response.json();
        console.log('Paystack response:', JSON.stringify(data, null, 2));
        
        if (!response.ok) {
            console.error('Paystack error details:', JSON.stringify(data, null, 2));
            return res.status(response.status).json({ 
                error: data.message || 'Payment initialization failed',
                details: data 
            });
        }

        return res.json(data);
    } catch (error) {
        console.error('Error initializing payment:', error);
        return res.status(500).json({ 
            error: error.message || 'Internal server error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
