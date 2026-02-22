import React, { useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Plus, X, Send, Bot, User,
    Volume2, Mic, Globe, ChevronDown, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ChatWidget.css';

const SUPPORTED_LANGUAGES = [
    { code: 'en-US', name: 'English', label: 'EN' },
    { code: 'hi-IN', name: 'Hindi', label: 'HI' },
    { code: 'es-ES', name: 'Spanish', label: 'ES' },
    { code: 'fr-FR', name: 'French', label: 'FR' },
];

const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [chats, setChats] = useState(() => {
        const saved = localStorage.getItem('bank_ai_chats');
        return saved ? JSON.parse(saved) : [];
    });
    const [currentChatId, setCurrentChatId] = useState(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedLang, setSelectedLang] = useState(SUPPORTED_LANGUAGES[0]);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [autoVocalOutput, setAutoVocalOutput] = useState(false);
    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);

    // Initialize Speech Recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = selectedLang.code;

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(prev => prev + (prev ? ' ' : '') + transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech Recognition Error:", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, [selectedLang]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            if (recognitionRef.current) {
                recognitionRef.current.lang = selectedLang.code;
                recognitionRef.current.start();
                setIsListening(true);
            }
        }
    };

    const handleSpeak = (text) => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = selectedLang.code;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
    };

    useEffect(() => {
        localStorage.setItem('bank_ai_chats', JSON.stringify(chats));
    }, [chats]);

    const currentChat = chats.find(c => c.id === currentChatId);
    const messages = currentChat ? currentChat.messages : [];

    const handleNewChat = () => {
        const newId = Date.now().toString();
        const newChat = {
            id: newId,
            title: 'New Chat',
            messages: [],
            timestamp: Date.now()
        };
        setChats([newChat, ...chats]);
        setCurrentChatId(newId);
    };

    const setMessagesForCurrentChat = (newMessages) => {
        if (!currentChatId) {
            const newId = Date.now().toString();
            const newChat = {
                id: newId,
                title: newMessages[0]?.content.slice(0, 30) + (newMessages[0]?.content.length > 30 ? '...' : '') || 'New Chat',
                messages: newMessages,
                timestamp: Date.now()
            };
            setChats([newChat, ...chats]);
            setCurrentChatId(newId);
            return;
        }

        setChats(prev => prev.map(chat => {
            if (chat.id === currentChatId) {
                let title = chat.title;
                if (chat.title === 'New Chat' && newMessages.length > 0) {
                    title = newMessages[0].content.slice(0, 30) + (newMessages[0].content.length > 30 ? '...' : '');
                }
                return { ...chat, messages: newMessages, title };
            }
            return chat;
        }));
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = { role: 'user', content: input };
        const newMessages = [...messages, userMsg];
        setMessagesForCurrentChat(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'meta-llama/Meta-Llama-3-8B-Instruct',
                    messages: [
                        { role: 'system', content: `You are KodBank's AI Assistant. Help users with banking queries. Current language: ${selectedLang.name}` },
                        ...newMessages
                    ],
                    max_tokens: 500,
                }),
            });

            const data = await response.json();
            const aiContent = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";

            setMessagesForCurrentChat([...newMessages, { role: 'assistant', content: aiContent }]);

            if (autoVocalOutput) {
                handleSpeak(aiContent);
            }
        } catch (error) {
            console.error(error);
            setMessagesForCurrentChat([...newMessages, { role: 'assistant', content: "Connection Error. Please check API key/Proxy." }]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <>
            <div className="brokod-trigger" onClick={() => setIsOpen(true)}>
                <Bot size={20} />
                <span>GPTKod</span>
            </div>

            {isOpen && (
                <div className="chat-modal-overlay">
                    <div className="chat-modal-content">
                        <button className="close-btn" onClick={() => setIsOpen(false)}>
                            <X size={20} />
                        </button>

                        <div className="app-container-overlay">
                            {/* Sidebar */}
                            <div className="sidebar-mini">
                                <button className="btn-primary" style={{ marginBottom: '1rem' }} onClick={handleNewChat}>
                                    <Plus size={16} /> New Chat
                                </button>
                                <div style={{ overflowY: 'auto', flex: 1 }}>
                                    {chats.map(chat => (
                                        <div
                                            key={chat.id}
                                            onClick={() => setCurrentChatId(chat.id)}
                                            style={{
                                                padding: '0.75rem',
                                                borderRadius: '0.5rem',
                                                cursor: 'pointer',
                                                background: currentChatId === chat.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                marginBottom: '0.5rem',
                                                fontSize: '0.9rem',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}
                                        >
                                            <MessageSquare size={14} style={{ marginRight: '8px' }} />
                                            {chat.title}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Chat Area */}
                            <div className="chat-area">
                                <div className="top-bar">
                                    <h3 style={{ margin: 0 }}>GPTKod AI Assistant</h3>
                                    <div style={{ flex: 1 }} />
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <button
                                            className={`icon-btn ${autoVocalOutput ? 'active' : ''}`}
                                            onClick={() => setAutoVocalOutput(!autoVocalOutput)}
                                            title="Toggle Auto Vocal Output"
                                        >
                                            <Volume2 size={18} />
                                        </button>
                                        <div className="divider-v" />
                                        <Globe size={18} color="#94a3b8" />
                                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{selectedLang.label}</span>
                                    </div>
                                </div>

                                <div className="messages-container">
                                    {messages.length === 0 ? (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#94a3b8' }}>
                                            <Bot size={64} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                            <h2>How can I help you today?</h2>
                                        </div>
                                    ) : (
                                        messages.map((m, i) => (
                                            <div key={i} className={`message-row ${m.role}`}>
                                                <div className="message-bubble">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                                                    {m.role === 'assistant' && (
                                                        <div className="msg-actions">
                                                            <button onClick={() => handleSpeak(m.content)} className="icon-btn-sm">
                                                                <Volume2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                <div className="input-area-wrapper">
                                    <div className="input-container">
                                        <button
                                            className={`icon-btn ${isListening ? 'listening' : ''}`}
                                            onClick={toggleListening}
                                            title="Voice Input"
                                        >
                                            <Mic size={20} />
                                        </button>
                                        <textarea
                                            className="chat-input"
                                            placeholder="Ask anything..."
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={handleSend}
                                            disabled={isLoading || !input.trim()}
                                            className="icon-btn"
                                            style={{ color: isLoading ? '#94a3b8' : 'var(--primary)' }}
                                        >
                                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatWidget;
