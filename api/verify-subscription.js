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

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        console.log('Verifying subscription for email:', email);

        const db = await connectToDatabase();
        const subscription = await db.collection('subscriptions').findOne({
            email: email.toLowerCase(),
            status: 'active',
            expiryDate: { $gt: new Date() }
        });

        console.log('Subscription found:', subscription);

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
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
