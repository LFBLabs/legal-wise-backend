import { connectToDatabase } from '../utils/db';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const db = await connectToDatabase();
        const subscription = await db.collection('subscriptions').findOne({
            email: email.toLowerCase(),
            status: 'active',
            expiryDate: { $gt: new Date() }
        });

        if (!subscription) {
            return res.json({ active: false });
        }

        return res.json({
            active: true,
            plan: subscription.plan,
            expiryDate: subscription.expiryDate
        });
    } catch (error) {
        console.error('Error verifying subscription:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
