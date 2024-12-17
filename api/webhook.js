import crypto from 'crypto';
import { connectToDatabase } from '../utils/db';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Paystack-Signature'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const event = req.body;
        console.log('Received webhook event:', JSON.stringify(event, null, 2));
        console.log('Headers:', req.headers);

        // Verify webhook signature
        const hash = crypto
            .createHmac('sha512', PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');
        
        if (hash !== req.headers['x-paystack-signature']) {
            console.error('Invalid signature. Expected:', hash, 'Got:', req.headers['x-paystack-signature']);
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Only process successful charge events
        if (event.event === 'charge.success') {
            console.log('Processing successful charge event');
            const db = await connectToDatabase();
            
            // Calculate expiry date based on plan
            const expiryDate = new Date();
            const plan = event.data.metadata?.plan || 'monthly';
            
            if (plan === 'annual') {
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            } else {
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            }

            const email = event.data.customer.email.toLowerCase();
            console.log('Updating subscription for:', email, 'Plan:', plan, 'Expiry:', expiryDate);

            // Update or create subscription
            const result = await db.collection('subscriptions').updateOne(
                { email: email },
                {
                    $set: {
                        email: email,
                        plan: plan,
                        status: 'active',
                        expiryDate: expiryDate,
                        lastPayment: {
                            reference: event.data.reference,
                            amount: event.data.amount,
                            date: new Date(),
                            paymentDetails: event.data
                        }
                    }
                },
                { upsert: true }
            );

            console.log('Subscription update result:', result);
        } else {
            console.log('Ignoring non-charge.success event:', event.event);
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
