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

    const { email, amount, plan } = req.body;

    if (!email || !amount || !plan) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const paymentData = {
            email,
            amount: amount * 100, // Convert to kobo/cents
            currency: 'ZAR',
            callback_url: 'https://legal-wise-backend.vercel.app/api/payment-callback',
            metadata: {
                email,
                plan,
                product: 'Legal Wise Summarizer'
            }
        };

        // Only add plan if it's a subscription
        if (plan === 'monthly' || plan === 'annual') {
            paymentData.plan = plan === 'monthly' ? 'PLN_qwa0am0k0i5jg3c' : 'PLN_rvzz5oylqsq8uyi';
        }

        console.log('Initializing payment with data:', JSON.stringify(paymentData, null, 2));

        // Initialize payment with Paystack
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
