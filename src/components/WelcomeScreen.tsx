import { useState } from 'react';

interface WelcomeScreenProps {
    onProjectLoaded: () => void;
}

export function WelcomeScreen({ onProjectLoaded }: WelcomeScreenProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSelectProject = async () => {
        setIsLoading(true);
        setError('');
        try {
            // @ts-ignore
            const path = await window.ipcRenderer.invoke('agent:select-directory');
            if (!path) {
                setIsLoading(false);
                return; // Canceled
            }

            // Init Project
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('agent:init-project', path);
            if (result.success) {
                onProjectLoaded();
            } else {
                setError(result.error);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#030407] text-[#e0faff] overflow-hidden relative">
            {/* Scanline Overlay */}
            <div className="scanlines pointer-events-none absolute inset-0 z-50"></div>

            <div className="max-w-xl w-full relative z-10">
                {/* Decorative Border */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#00f3ff]/20 to-[#ffaa00]/20 rounded-lg blur opacity-25"></div>

                <div className="bg-[#0a0c14] border border-[#00f3ff]/30 p-12 text-center relative overflow-hidden">
                    {/* Corner Accents */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00f3ff]"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00f3ff]"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#00f3ff]"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00f3ff]"></div>

                    <div className="mb-8">
                        <div className="w-16 h-16 mx-auto bg-[#00f3ff]/10 rounded-full flex items-center justify-center mb-4 border border-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.3)] animate-pulse">
                            <span className="text-3xl">⎈</span>
                        </div>
                        <h1 className="text-5xl font-display tracking-widest text-[#00f3ff] glow-text mb-2 upercase">
                            AGENT<span className="text-white">.OS</span>
                        </h1>
                        <p className="font-mono text-cyan-400/60 tracking-widest text-xs uppercase">
                            Autonomous Project Management System
                        </p>
                    </div>

                    <div className="space-y-6">
                        <button
                            onClick={handleSelectProject}
                            disabled={isLoading}
                            className="w-full py-5 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 border border-[#00f3ff]/50 rounded text-[#00f3ff] font-bold text-lg tracking-[0.2em] uppercase transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,243,255,0.2)] hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 group relative overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center justify-center space-x-2">
                                <span>INITIALIZE_PROJECT</span>
                                <span className="text-xl group-hover:translate-x-1 transition-transform">›</span>
                            </span>
                        </button>

                        <div className="text-xs font-mono text-gray-500 uppercase tracking-wide">
                            <p>Secure Terminal Connection • v1.0.4</p>
                        </div>
                    </div>

                    {isLoading && (
                        <div className="mt-8 font-mono text-xs text-[#00ff9d] animate-pulse">
                            &gt; ESTABLISHING LINK...
                        </div>
                    )}

                    {error && (
                        <div className="mt-6 p-3 bg-red-900/20 border border-red-500/50 text-red-400 font-mono text-xs">
                            !! SYSTEM ERROR: {error}
                        </div>
                    )}
                </div>
            </div>

            {/* Background elements */}
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00f3ff]/20 to-transparent"></div>
            <div className="absolute bottom-10 right-10 font-mono text-[10px] text-[#00f3ff]/30">
                SYSTEM_ID: {Math.random().toString(36).substring(7).toUpperCase()}
            </div>
        </div>
    );
}
