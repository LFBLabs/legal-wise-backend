import crypto from 'crypto';
import { connectToDatabase } from '../utils/db';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const event = req.body;
        console.log('Received webhook event:', event);

        // Verify webhook signature
        const hash = crypto
            .createHmac('sha512', PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');
        
        if (hash !== req.headers['x-paystack-signature']) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Only process successful charge events
        if (event.event === 'charge.success') {
            const db = await connectToDatabase();
            
            // Calculate expiry date based on plan
            const expiryDate = new Date();
            const plan = event.data.metadata?.plan || 'monthly';
            
            if (plan === 'annual') {
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            } else {
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            }

            // Update or create subscription
            await db.collection('subscriptions').updateOne(
                { email: event.data.customer.email.toLowerCase() },
                {
                    $set: {
                        email: event.data.customer.email.toLowerCase(),
                        plan: plan,
                        status: 'active',
                        expiryDate: expiryDate,
                        lastPayment: {
                            reference: event.data.reference,
                            amount: event.data.amount,
                            date: new Date()
                        }
                    }
                },
                { upsert: true }
            );

            console.log('Subscription updated for:', event.data.customer.email);
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
