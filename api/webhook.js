import crypto from 'crypto';
import { connectToDatabase } from '../utils/db';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

function verifyPaystackWebhook(req) {
    const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest('hex');
    
    return hash === req.headers['x-paystack-signature'];
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Verify webhook signature
        if (!verifyPaystackWebhook(req)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const { event, data } = req.body;

        // Only process successful charge events
        if (event === 'charge.success') {
            const db = await connectToDatabase();
            
            // Calculate expiry date based on plan
            const expiryDate = new Date();
            const plan = data.metadata?.plan || 'monthly';
            
            if (plan === 'annual') {
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            } else {
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            }

            // Update or create subscription
            await db.collection('subscriptions').updateOne(
                { email: data.customer.email.toLowerCase() },
                {
                    $set: {
                        email: data.customer.email.toLowerCase(),
                        plan: plan,
                        status: 'active',
                        expiryDate: expiryDate,
                        lastPayment: {
                            reference: data.reference,
                            amount: data.amount,
                            date: new Date()
                        }
                    }
                },
                { upsert: true }
            );
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
