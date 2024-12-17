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
        // Initialize payment with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                amount,
                currency: 'ZAR',
                callback_url: 'https://legal-wise-backend.vercel.app/api/payment-callback',
                metadata: {
                    email,
                    plan,
                    product: 'Legal Wise Summarizer'
                }
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Paystack error:', data);
            return res.status(response.status).json({ error: data.message });
        }

        return res.json(data);
    } catch (error) {
        console.error('Error initializing payment:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
