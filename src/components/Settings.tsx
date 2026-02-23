import { useState } from 'react';

type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama';

interface ModelInfo {
    id: string;
    name: string;
    provider: LLMProvider;
}

export function Settings() {
    const [provider, setProvider] = useState<LLMProvider>('ollama');
    const [apiKey, setApiKey] = useState('');
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');

    const fetchModels = async () => {
        setIsLoading(true);
        setStatus('Initializing handshake...');
        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('agent:get-models', provider, apiKey);
            const fetchedModels = result; // Direct result
            setModels(fetchedModels);
            if (fetchedModels.length > 0) {
                // Prefer gemini-1.5-flash for Google if available, else first
                const defaultModel = provider === 'google' 
                    ? fetchedModels.find((m: any) => m.id.includes('1.5-flash'))?.id || fetchedModels[0].id
                    : fetchedModels[0].id;
                
                setSelectedModel(defaultModel);
                setStatus(`Connection established. ${fetchedModels.length} compatible units detected.`);
            } else {
                setStatus('Scan complete. No compatible units found in local sector.');
            }
        } catch (error: any) {
            console.error(error);
            setStatus(`Handshake Failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('agent:configure-llm', {
                provider,
                modelId: selectedModel,
                apiKey
            });
            if (result.success) {
                setStatus('Configuration parameters written to core memory. System Ready.');
            } else {
                setStatus(`Write Failed: ${result.error}`);
            }
        } catch (error: any) {
            setStatus(`Critical Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-8 font-mono space-y-8">
            <div className="flex items-center space-x-4 border-b border-[#00f3ff]/20 pb-4">
                <div className="text-2xl animate-spin-slow text-[#00f3ff]">⚙</div>
                <div>
                    <h2 className="text-xl font-display tracking-[0.2em] text-white uppercase">System Configuration</h2>
                    <p className="text-[10px] text-[#00f3ff]/60 uppercase tracking-widest">Core AI Parameters</p>
                </div>
            </div>

            <div className="bg-[#0a0c14] border border-[#00f3ff]/20 p-6 relative">
                {/* Decorative Brackets */}
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-[#00f3ff]"></div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-[#00f3ff]"></div>

                <div className="space-y-8">
                    {/* Provider Selection */}
                    <div>
                        <label className="block text-xs font-bold text-[#00f3ff] uppercase tracking-widest mb-3">
                            Start Provider Protocol
                        </label>
                        <div className="grid grid-cols-4 gap-4">
                            {(['ollama', 'openai', 'anthropic', 'google'] as LLMProvider[]).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => { setProvider(p); setModels([]); }}
                                    className={`px-4 py-3 text-sm uppercase tracking-wider relative group transition-all
                                        ${provider === p
                                            ? 'bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.2)]'
                                            : 'bg-black/50 text-gray-500 border border-gray-800 hover:border-gray-600 hover:text-gray-300'
                                        }`}
                                >
                                    {/* Tech corners for buttons */}
                                    <div className={`absolute top-0 left-0 w-1 h-1 transition-colors ${provider === p ? 'bg-[#00f3ff]' : 'bg-gray-800 group-hover:bg-gray-600'}`}></div>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Key */}
                    {provider !== 'ollama' && (
                        <div>
                            <label className="block text-xs font-bold text-[#00f3ff] uppercase tracking-widest mb-3">
                                Security Token (API Key)
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="w-full bg-black/50 border border-[#00f3ff]/30 text-white px-4 py-3 focus:outline-none focus:border-[#00f3ff] focus:bg-[#00f3ff]/5 font-mono tracking-widest transition-all"
                                    placeholder={`ENTER_${provider.toUpperCase()}_TOKEN...`}
                                />
                                <div className="absolute right-0 top-0 h-full w-1 bg-[#00f3ff]/30"></div>
                            </div>
                        </div>
                    )}

                    {/* Model Selection */}
                    <div>
                        <label className="block text-xs font-bold text-[#00f3ff] uppercase tracking-widest mb-3">
                            Neural Model Selection
                        </label>
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    disabled={models.length === 0}
                                    className="w-full appearance-none bg-black/50 border border-[#00f3ff]/30 text-cyan-50 px-4 py-3 pr-8 focus:outline-none focus:border-[#00f3ff] focus:bg-[#00f3ff]/5 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {models.length === 0 ? (
                                        <option>AWAITING_SCAN...</option>
                                    ) : (
                                        models.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))
                                    )}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#00f3ff]">▼</div>
                            </div>
                            <button
                                onClick={fetchModels}
                                disabled={isLoading || (provider !== 'ollama' && !apiKey)}
                                className="px-6 py-3 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/30 uppercase text-xs font-bold tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.1)]"
                            >
                                {isLoading ? 'Scanning...' : 'Scan_Net'}
                            </button>
                        </div>
                        {provider === 'ollama' && models.length === 0 && !isLoading && (
                            <div className="mt-2 p-2 border-l-2 border-amber-500 bg-amber-500/5 text-amber-500 text-xs">
                                ⚠ WARNING: Local OLLAMA instance not detected on standard port.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Save Action */}
            <button
                onClick={handleSave}
                disabled={!selectedModel || isLoading}
                className="w-full group relative py-4 bg-[#00f3ff] hover:brightness-110 disabled:grayscale disabled:cursor-not-allowed transition-all overflow-hidden"
            >
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                <span className="relative font-display text-black font-bold text-lg tracking-[0.2em] uppercase group-hover:tracking-[0.3em] transition-all">
                    {isLoading ? 'Processing...' : 'Initializing_Core'}
                </span>
            </button>

            {/* Terminal Output */}
            <div className="bg-black border border-gray-800 p-4 font-mono text-xs h-32 overflow-y-auto custom-scrollbar shadow-inner">
                <div className="text-gray-500 mb-1 border-b border-gray-900 pb-1">System Log // Output Stream</div>
                {status ? (
                    <div className={`${status.includes('Failed') || status.includes('Error') ? 'text-red-500' : 'text-[#00ff9d]'}`}>
                        <span className="opacity-50 mr-2">{new Date().toLocaleTimeString()} &gt;&gt;</span>
                        {status}
                    </div>
                ) : (
                    <div className="text-gray-700 italic opacity-50">System Idle. Waiting for input...</div>
                )}
            </div>
        </div>
    );
}

