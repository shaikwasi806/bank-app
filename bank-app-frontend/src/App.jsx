import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, LogOut, Send, User, ShieldCheck, TrendingUp, History } from 'lucide-react';
import ChatWidget from './components/ChatWidget';

// Axios config to include credentials for cookies
axios.defaults.withCredentials = true;

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Try to get user balance to see if logged in
        axios.get('/api/balance')
            .then(res => {
                setUser({ cname: res.data.cname });
                setLoading(false);
            })
            .catch(() => {
                setUser(null);
                setLoading(false);
            });
    }, []);

    return (
        <AuthContext.Provider value={{ user, setUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

const NavBar = () => {
    const { user, setUser } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await axios.post('/api/logout');
            setUser(null);
            navigate('/login');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <nav className="nav">
            <div className="nav-logo">KodBank</div>
            <div style={{ flex: 1 }} />
            {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span>Welcome, {user.cname}</span>
                    <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}>
                        <LogOut size={20} />
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link to="/login" style={{ color: 'var(--text)', textDecoration: 'none' }}>Login</Link>
                    <Link to="/register" style={{ color: 'var(--text)', textDecoration: 'none' }}>Register</Link>
                </div>
            )}
        </nav>
    );
};

const Register = () => {
    const [formData, setFormData] = useState({ cname: '', email: '', password: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/register', formData);
            // Auto-redirect to login
            navigate('/login');
        } catch (err) {
            console.error(err);
            if (err.response) {
                alert(err.response.data.message || 'Error occurred');
            } else if (err.request) {
                alert('Server Unreachable. Please ensure the backend is running on port 5000.');
            } else {
                alert('Error: ' + err.message);
            }
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass" style={{ padding: '2rem', maxWidth: '400px', margin: 'auto' }}>
            <h2>Create Account</h2>
            <form onSubmit={handleSubmit}>
                <input type="text" placeholder="Full Name" className="form-input" required onChange={e => setFormData({ ...formData, cname: e.target.value })} />
                <input type="email" placeholder="Email" className="form-input" required onChange={e => setFormData({ ...formData, email: e.target.value })} />
                <input type="password" placeholder="Password" className="form-input" required onChange={e => setFormData({ ...formData, password: e.target.value })} />
                <button type="submit" className="btn-primary">Register</button>
            </form>
            <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Already have an account? <Link to="/login" style={{ color: '#6366f1' }}>Login</Link></p>
        </motion.div>
    );
};

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const { setUser } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/login', formData);
            setUser(res.data.user);
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            if (err.response) {
                alert(err.response.data.message || 'Invalid credentials');
            } else if (err.request) {
                alert('Server Unreachable. Please ensure the backend is running on port 5000.');
            } else {
                alert('Error: ' + err.message);
            }
        }
    };

    return (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass" style={{ padding: '2rem', maxWidth: '400px', margin: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <ShieldCheck size={48} color="#6366f1" style={{ marginBottom: '1rem' }} />
                <h2>Secure Login</h2>
            </div>
            <form onSubmit={handleSubmit}>
                <input type="email" placeholder="Email" className="form-input" required onChange={e => setFormData({ ...formData, email: e.target.value })} />
                <input type="password" placeholder="Password" className="form-input" required onChange={e => setFormData({ ...formData, password: e.target.value })} />
                <button type="submit" className="btn-primary">Sign In</button>
            </form>
            <p style={{ marginTop: '1rem', color: '#94a3b8', textAlign: 'center' }}>
                New to KodBank? <Link to="/register" style={{ color: '#6366f1' }}>Join now</Link>
            </p>
        </motion.div>
    );
};

const Dashboard = () => {
    const [balance, setBalance] = useState(null);
    const [showBalance, setShowBalance] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [activeView, setActiveView] = useState('main'); // 'main', 'Transactions', 'Investment', etc.
    const [transferData, setTransferData] = useState({ recipientEmail: '', amount: '' });
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) navigate('/login');
        // We don't fetch balance on mount anymore to keep it hidden
        fetchTransactions();
    }, [user]);

    const fetchBalance = async () => {
        try {
            const res = await axios.get('/api/balance');
            setBalance(res.data.balance);
            setShowBalance(true);
        } catch (err) {
            navigate('/login');
        }
    };

    const fetchTransactions = async () => {
        try {
            const res = await axios.get('/api/transactions');
            setTransactions(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/transfer', transferData);
            alert(res.data.message);
            setBalance(res.data.newBalance);
            setTransferData({ recipientEmail: '', amount: '' });
            fetchTransactions();
        } catch (err) {
            console.error(err);
            if (err.response) {
                alert(err.response.data.message || 'Transfer failed');
            } else if (err.request) {
                alert('Server Unreachable. Please ensure the backend is running on port 5000.');
            } else {
                alert('Error: ' + err.message);
            }
        }
    };

    const renderMainView = () => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {/* Balance Card */}
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="glass" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <p style={{ color: '#94a3b8', margin: 0 }}>Current Balance</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                            <h1 style={{ fontSize: '3rem', margin: 0 }}>
                                {showBalance ? `₹${balance?.toLocaleString()}` : '₹ ••••••'}
                            </h1>
                            <button
                                onClick={showBalance ? () => setShowBalance(false) : fetchBalance}
                                className="btn-primary"
                                style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                            >
                                {showBalance ? 'Hide Balance' : 'Check Balance'}
                            </button>
                        </div>
                    </div>
                    <Wallet size={48} color="#6366f1" />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '1rem', flex: 1 }}>
                        <TrendingUp size={20} color="#6366f1" />
                        <p style={{ fontSize: '0.8rem', margin: '0.5rem 0 0' }}>Monthly Income</p>
                        <p style={{ fontWeight: 600, margin: 0 }}>+ ₹12,450</p>
                    </div>
                    <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '1rem', borderRadius: '1rem', flex: 1 }}>
                        <History size={20} color="#ec4899" />
                        <p style={{ fontSize: '0.8rem', margin: '0.5rem 0 0' }}>Monthly Spent</p>
                        <p style={{ fontWeight: 600, margin: 0 }}>- ₹8,200</p>
                    </div>
                </div>
            </motion.div>

            {/* Transfer Card */}
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="glass" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <Send size={24} color="#6366f1" />
                    <h3>Send Money</h3>
                </div>
                <form onSubmit={handleTransfer}>
                    <input
                        type="email"
                        placeholder="Recipient Email"
                        className="form-input"
                        required
                        value={transferData.recipientEmail}
                        onChange={e => setTransferData({ ...transferData, recipientEmail: e.target.value })}
                    />
                    <input
                        type="number"
                        placeholder="Amount to Transfer"
                        className="form-input"
                        required
                        value={transferData.amount}
                        onChange={e => setTransferData({ ...transferData, amount: e.target.value })}
                    />
                    <button type="submit" className="btn-primary">Confirm Transfer</button>
                </form>
            </motion.div>
        </div>
    );

    const renderTransactionsView = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass" style={{ padding: '2rem', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>Recent Transactions</h3>
                <button onClick={() => setActiveView('main')} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Back</button>
            </div>
            {transactions.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8' }}>No transactions found.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {transactions.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                            <div>
                                <p style={{ margin: 0, fontWeight: 600 }}>{t.senderEmail === user.email ? `To: ${t.recipientEmail}` : `From: ${t.senderEmail}`}</p>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>{t.timestamp}</p>
                            </div>
                            <div style={{ color: t.senderEmail === user.email ? '#ef4444' : '#22c55e', fontWeight: 800 }}>
                                {t.senderEmail === user.email ? '-' : '+'} ₹{t.amount.toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );

    const renderInfoView = (title, message) => (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass" style={{ padding: '2rem', textAlign: 'center', width: '100%' }}>
            <h3>{title}</h3>
            <p style={{ color: '#94a3b8', margin: '2rem 0' }}>{message}</p>
            <button onClick={() => setActiveView('main')} className="btn-primary" style={{ maxWidth: '200px', margin: '0 auto' }}>Back to Dashboard</button>
        </motion.div>
    );

    return (
        <div style={{ maxWidth: '1000px', margin: '80px auto 0', width: '100%' }}>
            <AnimatePresence mode="wait">
                {activeView === 'main' && (
                    <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {renderMainView()}
                    </motion.div>
                )}
                {activeView === 'Transactions' && (
                    <motion.div key="transactions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {renderTransactionsView()}
                    </motion.div>
                )}
                {activeView === 'Investment' && (
                    <motion.div key="investment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {renderInfoView('Portfolio Insights', 'Investment simulation coming soon. Track your stocks and mutual funds here.')}
                    </motion.div>
                )}
                {activeView === 'Credit Score' && (
                    <motion.div key="credit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {renderInfoView('Credit Report', 'Your current credit score is 785 (Excellent). You are eligible for premium loan offers.')}
                    </motion.div>
                )}
                {activeView === 'Settings' && (
                    <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {renderInfoView('Account Settings', 'Manage your security, notifications, and profile preferences.')}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Quick Actions */}
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {['Transactions', 'Investment', 'Credit Score', 'Settings'].map(item => (
                    <div
                        key={item}
                        onClick={() => setActiveView(item)}
                        className="glass"
                        style={{
                            padding: '1rem 2rem',
                            cursor: 'pointer',
                            flex: 1,
                            textAlign: 'center',
                            fontSize: '0.9rem',
                            minWidth: '120px',
                            transition: 'all 0.3s ease',
                            background: activeView === item ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.7)',
                            borderColor: activeView === item ? 'var(--primary)' : 'var(--border)'
                        }}
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>
    );
};

const App = () => {
    return (
        <AuthProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <NavBar />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/" element={<Login />} />
                </Routes>
                <ChatWidget />
            </BrowserRouter>
        </AuthProvider>
    );
};

export default App;
