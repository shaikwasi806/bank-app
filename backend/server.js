const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');
const fs = require('fs');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'supersecretkey_banking_simulation';

// ---------------------------------------------------------------------------
// Storage: use a JSON file locally, fall back to in-memory on Vercel
// (Vercel serverless functions have a read-only filesystem)
// ---------------------------------------------------------------------------
const DB_PATH = path.join(__dirname, 'db.json');
const IS_VERCEL = !!process.env.VERCEL;

// In-memory store (always used on Vercel, used as cache locally)
let memDB = { users: [], transactions: [] };

const loadDB = () => {
    if (IS_VERCEL) return memDB;
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], transactions: [] }, null, 2));
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch {
        return memDB;
    }
};

const saveDB = (db) => {
    if (IS_VERCEL) {
        memDB = db;
        return;
    }
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch {
        memDB = db;
    }
};

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// In-memory JWT tracking
const BankUserJwt = [];

// ── Routes ─────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', storage: IS_VERCEL ? 'memory' : 'file' });
});

// Register
app.post('/api/register', async (req, res) => {
    const { cname, password, email } = req.body;
    if (!cname || !password || !email) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    const db = loadDB();

    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        cid: db.users.length + 1,
        cname,
        cpwd: hashedPassword,
        balance: 1000,
        email
    };

    db.users.push(newUser);
    saveDB(db);

    res.status(201).json({
        message: 'User registered successfully',
        user: { cid: newUser.cid, cname: newUser.cname, email: newUser.email }
    });
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.cpwd))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ cid: user.cid, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    BankUserJwt.push({
        tokenid: BankUserJwt.length + 1,
        tokenvalue: token,
        cid: user.cid,
        exp: new Date(Date.now() + 3600000).toLocaleTimeString()
    });

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 3600000
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
    if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = loadDB();
        const user = db.users.find(u => u.cid === decoded.cid);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ balance: user.balance, cname: user.cname });
    } catch {
        res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
});

// Transfer Money
app.post('/api/transfer', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { recipientEmail, amount } = req.body;
        const db = loadDB();

        const sender = db.users.find(u => u.cid === decoded.cid);
        const recipient = db.users.find(u => u.email === recipientEmail);

        if (!recipient) return res.status(404).json({ message: 'Recipient not found' });
        if (sender.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });

        sender.balance -= Number(amount);
        recipient.balance += Number(amount);

        const transaction = {
            id: db.transactions.length + 1,
            senderId: sender.cid,
            senderEmail: sender.email,
            recipientEmail: recipient.email,
            amount: Number(amount),
            timestamp: new Date().toLocaleString(),
            type: 'transfer'
        };
        db.transactions.push(transaction);
        saveDB(db);

        res.json({ message: 'Transfer successful', newBalance: sender.balance });
    } catch {
        res.status(401).json({ message: 'Unauthorized' });
    }
});

// Get Transactions (Protected)
app.get('/api/transactions', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = loadDB();
        const userTransactions = db.transactions.filter(t =>
            t.senderId === decoded.cid ||
            t.senderEmail === decoded.email ||
            t.recipientEmail === decoded.email
        );
        res.json(userTransactions);
    } catch {
        res.status(401).json({ message: 'Unauthorized' });
    }
});

// AI Chat Proxy
app.post('/api/ai/chat', async (req, res) => {
    try {
        const hfKey = process.env.HF_API_KEY;
        if (!hfKey || hfKey === 'your_huggingface_api_key_here') {
            return res.status(500).json({ error: 'HF_API_KEY is not configured on the server.' });
        }

        const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
        });
        const data = await response.json();

        if (!response.ok) {
            console.error('HuggingFace API Error:', response.status, data);
            return res.status(response.status).json({ error: data.error || 'AI Provider Error' });
        }

        res.json(data);
    } catch (error) {
        console.error('AI Proxy Error:', error);
        res.status(500).json({ error: error.message || 'Failed to connect to AI service' });
    }
});

// Local dev server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Backend server running at http://localhost:${PORT}`);
        console.log(`Storage mode: ${IS_VERCEL ? 'in-memory' : 'file (db.json)'}`);
    });
}

module.exports = app;
