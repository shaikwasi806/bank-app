const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'supersecretkey_banking_simulation';

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Simulation "Database"
const BankUser = [];

const BankUserJwt = [];
const BankTransactions = [];

// Seed passwords (hashed)
const seedPasswords = async () => {
    for (let user of BankUser) {
        user.cpwd = await bcrypt.hash(user.cname.toLowerCase(), 10);
    }
};
seedPasswords();

// Routes

// Register
app.post('/api/register', async (req, res) => {
    const { cname, password, email } = req.body;

    if (BankUser.find(u => u.email === email)) {
        return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        cid: BankUser.length + 1,
        cname,
        cpwd: hashedPassword,
        balance: 1000, // Starting balance
        email
    };

    BankUser.push(newUser);
    res.status(201).json({ message: 'User registered successfully', user: { cid: newUser.cid, cname: newUser.cname, email: newUser.email } });
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = BankUser.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.cpwd))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ cid: user.cid, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    // Store in "BankUserJwt" table as per user request
    const tokenRecord = {
        tokenid: BankUserJwt.length + 1,
        tokenvalue: token,
        cid: user.cid,
        exp: new Date(Date.now() + 3600000).toLocaleTimeString()
    };
    BankUserJwt.push(tokenRecord);

    console.log('--- BankUserJwt Table Updated ---');
    console.table(BankUserJwt);

    // Set cookie
    res.cookie('token', token, {
        httpOnly: true,
        secure: false, // development
        maxAge: 3600000 // 1 hour
    });

    res.json({ message: 'Login successful', user: { cid: user.cid, cname: user.cname, email: user.email } });
});

// Logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// Check Balance (Protected)
app.get('/api/balance', (req, res) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = BankUser.find(u => u.cid === decoded.cid);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify if token exists in our "BankUserJwt" table
        const tokenInDb = BankUserJwt.find(t => t.tokenvalue === token);
        if (!tokenInDb) {
            return res.status(401).json({ message: 'Unauthorized: Token not in DB' });
        }

        res.json({ balance: user.balance, cname: user.cname });
    } catch (err) {
        res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
});

// Transfer Money (Bonus feature implied by diagram)
app.post('/api/transfer', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { recipientEmail, amount } = req.body;

        const sender = BankUser.find(u => u.cid === decoded.cid);
        const recipient = BankUser.find(u => u.email === recipientEmail);

        if (!recipient) return res.status(404).json({ message: 'Recipient not found' });
        if (sender.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });

        sender.balance -= Number(amount);
        recipient.balance += Number(amount);

        // Record transaction
        const transaction = {
            id: BankTransactions.length + 1,
            senderId: sender.cid,
            senderEmail: sender.email,
            recipientEmail: recipient.email,
            amount: Number(amount),
            timestamp: new Date().toLocaleString(),
            type: 'transfer'
        };
        BankTransactions.push(transaction);

        res.json({ message: 'Transfer successful', newBalance: sender.balance });
    } catch (err) {
        res.status(401).json({ message: 'Unauthorized' });
    }
});

// Get Transactions (Protected)
app.get('/api/transactions', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Returns transactions where the user is either sender or recipient
        const userTransactions = BankTransactions.filter(t =>
            t.senderId === decoded.cid || t.senderEmail === decoded.email || t.recipientEmail === decoded.email
        );
        res.json(userTransactions);
    } catch (err) {
        res.status(401).json({ message: 'Unauthorized' });
    }
});

// AI Chat Proxy
app.post('/api/ai/chat', async (req, res) => {
    try {
        const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HF_API_KEY || process.env.VITE_HF_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('AI Proxy Error:', error);
        res.status(500).json({ error: 'Failed to connect to AI service' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Backend server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
