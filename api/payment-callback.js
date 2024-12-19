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

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { reference } = req.query;
    if (!reference) {
        return res.status(400).json({ error: 'Reference is required' });
    }

    try {
        // Verify the transaction with Paystack
        const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
        });

        const verifyData = await verifyResponse.json();
        console.log('Payment verification response:', JSON.stringify(verifyData, null, 2));

        if (!verifyResponse.ok || !verifyData.status || verifyData.data.status !== 'success') {
            console.error('Payment verification failed:', verifyData);
            return res.redirect('/payment-failed.html');
        }

        const db = await connectToDatabase();

        // Get the initialization data
        const initData = await db.collection('payment_initializations').findOne({ reference });
        if (!initData) {
            console.error('No initialization data found for reference:', reference);
            return res.redirect('/payment-failed.html');
        }

        // Calculate expiry date based on plan
        const expiryDate = new Date();
        if (initData.plan === 'annual') {
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        } else {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
        }

        // Update or create subscription record
        await db.collection('subscriptions').updateOne(
            { email: initData.email },
            {
                $set: {
                    email: initData.email,
                    plan: initData.plan,
                    status: 'active',
                    expiryDate: expiryDate,
                    customer_code: initData.customer_code,
                    lastPayment: {
                        reference: reference,
                        amount: verifyData.data.amount / 100, // Convert from kobo to Rand
                        date: new Date(),
                        paymentDetails: verifyData.data
                    }
                }
            },
            { upsert: true }
        );

        // Update initialization status
        await db.collection('payment_initializations').updateOne(
            { reference },
            { 
                $set: { 
                    status: 'completed',
                    completed_at: new Date()
                }
            }
        );

        // Redirect to success page
        return res.redirect('/payment-success.html');
    } catch (error) {
        console.error('Error processing payment callback:', error);
        return res.redirect('/payment-failed.html');
    }
}
