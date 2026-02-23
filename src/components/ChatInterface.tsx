import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../../shared/ChatTypes';

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (content: string) => Promise<void>;
}

const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

export function ChatInterface({ messages, onSendMessage }: ChatInterfaceProps) {
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // Auto-focus input
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || isTyping) return;

        const content = inputValue;
        setInputValue('');

        setIsTyping(true);
        try {
            await onSendMessage(content);
        } finally {
            setIsTyping(false);
            // Re-focus after sending
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="flex flex-col h-full font-mono text-sm">
            {/* Messages Log */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                            {/* Header / Timestamp */}
                            <div className="flex items-center space-x-2 mb-1 opacity-70 text-xs">
                                <span className={msg.role === 'user' ? 'text-cyan-500' : 'text-amber-500'}>
                                    [{msg.role === 'user' ? 'CMD_IN' : 'SYS_OUT'}]
                                </span>
                                <span className="text-gray-500">
                                    {formatTime(msg.timestamp)}
                                </span>
                            </div>

                            {/* Message Frame */}
                            <div className={`
                                max-w-[90%] relative p-4 
                                ${msg.role === 'user'
                                    ? 'bg-[#00f3ff]/10 border-r-2 border-[#00f3ff] text-cyan-50 text-right'
                                    : 'bg-amber-500/5 border-l-2 border-amber-500/50 text-amber-50 text-left'
                                }
                            `}>
                                {/* Decorative Corner Markers */}
                                <div className={`absolute top-0 w-2 h-2 border-t border-${msg.role === 'user' ? 'cyan' : 'amber'}-500/50 ${msg.role === 'user' ? 'right-0 border-r' : 'left-0 border-l'}`}></div>
                                <div className={`absolute bottom-0 w-2 h-2 border-b border-${msg.role === 'user' ? 'cyan' : 'amber'}-500/50 ${msg.role === 'user' ? 'right-0 border-r' : 'left-0 border-l'}`}></div>

                                {msg.role === 'agent' ? (
                                    <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-code:text-amber-300">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                code: ({ children }) => <span className="font-mono text-xs bg-black/40 px-1 py-0.5 text-cyan-300 border border-cyan-900/50">{children}</span>,
                                                pre: ({ children }) => <pre className="bg-[#050505] border border-gray-800 p-3 overflow-x-auto my-2 text-xs font-mono custom-scrollbar">{children}</pre>,
                                                a: ({ href, children }) => <a href={href} className="text-[#00f3ff] underline hover:text-white decoration-1 underline-offset-2">{children}</a>,
                                                strong: ({ children }) => <strong className="text-white font-bold tracking-wide">{children}</strong>,
                                                h1: ({ children }) => <h1 className="text-lg font-bold text-[#00f3ff] border-b border-[#00f3ff]/20 pb-1 mb-2 uppercase tracking-widest">{children}</h1>,
                                                h2: ({ children }) => <h2 className="text-base font-bold text-[#00f3ff]/80 mb-2 mt-4 uppercase tracking-wider">{children}</h2>,
                                                ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 mb-2 marker:text-amber-600">{children}</ul>,
                                                ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 mb-2 marker:text-amber-600">{children}</ol>,
                                                blockquote: ({ children }) => <blockquote className="border-l-2 border-amber-700/50 pl-3 italic text-gray-400 my-2">{children}</blockquote>
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap font-mono">{msg.content}</div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Typing Indicator */}
                    {isTyping && (
                        <div className="flex flex-col items-start">
                            <div className="flex items-center space-x-2 mb-1 opacity-70 text-xs text-amber-500">
                                <span>[SYS_PROCESSING]</span>
                            </div>
                            <div className="bg-amber-500/5 border-l-2 border-amber-500/50 p-3 pt-4 min-w-[100px]">
                                <div className="flex space-x-1">
                                    <div className="w-1.5 h-3 bg-amber-500/50 animate-pulse"></div>
                                    <div className="w-1.5 h-3 bg-amber-500/50 animate-pulse delay-75"></div>
                                    <div className="w-1.5 h-3 bg-amber-500/50 animate-pulse delay-150"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Command Input Area */}
            <div className="shrink-0 p-1 bg-[#050505] border-t border-[#00f3ff]/20">
                <div className="max-w-4xl mx-auto bg-[#0a0c14] border border-[#00f3ff]/10 p-4 relative">
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f3ff]"></div>
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f3ff]"></div>
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f3ff]"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f3ff]"></div>

                    <form onSubmit={handleSubmit} className="flex items-center space-x-3">
                        <span className="text-[#00f3ff] font-bold text-lg select-none blink-cursor">{'>'}</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="ENTER_COMMAND..."
                            className="flex-1 bg-transparent text-[#00f3ff] placeholder-[#00f3ff]/30 text-base font-mono focus:outline-none tracking-wider h-10"
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            disabled={!inputValue.trim() || isTyping}
                            className="px-4 py-1 bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/30 hover:bg-[#00f3ff]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase text-xs tracking-widest font-bold"
                        >
                            Execute
                        </button>
                    </form>
                </div>
                <div className="text-center py-1">
                    <span className="text-[9px] text-gray-600 font-mono tracking-[0.3em] uppercase">Secure Connection Encrypted</span>
                </div>
            </div>
        </div>
    );
}

// Add blinking animation for cursor
const styles = `
.blink-cursor {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
`;
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
