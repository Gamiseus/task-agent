import { useState, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { TaskTree } from './components/TaskTree';
import { Settings } from './components/Settings';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Message } from '../shared/ChatTypes';

type AppMode = 'chat' | 'tasks' | 'settings';

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>('chat');
  const [isRunning, setIsRunning] = useState(false);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'agent',
      content: 'System Initialized. Awaiting Mission Parameters.',
      timestamp: Date.now()
    }
  ]);

  useEffect(() => {
    // Check status on mount
    const checkStatus = async () => {
      try {
        // @ts-ignore
        const status = await window.ipcRenderer.invoke('agent:get-status');
        setIsRunning(status.isRunning);
        setProjectPath(status.projectPath);
      } catch (e) { console.error(e); }
    };
    checkStatus();
  }, []);

  const handleSendMessage = async (content: string) => {
    // Optimistic update
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, userMsg]);

    // Call Backend
    try {
      // @ts-ignore
      const response = await window.ipcRenderer.invoke('agent:chat', content);
      setChatMessages(prev => [...prev, response]);
    } catch (e: any) {
      console.error("Chat Error", e);
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'agent',
        content: "Error: " + e.message,
        timestamp: Date.now()
      }]);
    }
  };

  const SidebarItem = ({ mode, icon, label }: { mode: AppMode, icon: string, label: string }) => (
    <button
      onClick={() => setActiveMode(mode)}
      className={`w-full p-4 flex items-center space-x-3 transition-all duration-300 border-l-2 
        ${activeMode === mode
          ? 'bg-cyan-900/20 border-[#00f3ff] text-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.2)]'
          : 'border-transparent text-gray-500 hover:text-cyan-200 hover:bg-white/5'
        }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-mono text-sm tracking-widest uppercase">{label}</span>
    </button>
  );

  if (!projectPath) {
    return <WelcomeScreen onProjectLoaded={() => setProjectPath('loaded')} />; // Assuming 'loaded' is a placeholder for actual path
  }

  return (
    <div className="flex h-screen w-screen text-[#e0faff] overflow-hidden relative">
      {/* Scanline Overlay */}
      <div className="scanlines pointer-events-none absolute inset-0 z-50"></div>

      {/* Sidebar - System Navigation */}
      <div className="w-64 bg-[#050505] border-r border-[#00f3ff]/20 flex flex-col z-10 tech-border hover:border-[#00f3ff]/40 transition-colors">
        <div className="p-6 border-b border-[#00f3ff]/10">
          <h1 className="font-display text-2xl tracking-widest text-[#00f3ff] glow-text">
            AGENT.<span className="text-white">OS</span>
          </h1>
          <div className="text-[10px] text-cyan-700 font-mono mt-1 tracking-[0.2em] uppercase">
            v1.0.4 // ONLINE
          </div>
        </div>

        <nav className="flex-1 py-6 space-y-1">
          <SidebarItem mode="chat" icon="⏻" label="CMD_TERMINAL" />
          <SidebarItem mode="tasks" icon="⫸" label="TASK_MATRIX" />
          <SidebarItem mode="settings" icon="⚙" label="SYS_CONFIG" />
        </nav>

        <div className="p-4 border-t border-[#00f3ff]/10 bg-[#0a0c14]">
          <div className="text-[10px] font-mono text-cyan-600 mb-1">active_project:</div>
          <div className="text-xs font-mono text-cyan-300 truncate opacity-80" title={projectPath}>
            {projectPath.split('\\').pop()}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-[#030407] relative z-0">
        {/* Header - Mission Control Status */}
        <header className="h-14 border-b border-[#00f3ff]/20 bg-[#0a0c14]/80 backdrop-blur flex items-center px-6 justify-between select-none">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] ${isRunning ? 'bg-[#00f3ff] animate-pulse text-[#00f3ff]' : 'bg-red-500 text-red-500'}`}></div>
            <span className="font-mono text-sm text-cyan-400 tracking-wider uppercase">
              system_status: <span className={isRunning ? "text-[#00ff9d]" : "text-red-500"}>{isRunning ? "ONLINE" : "OFFLINE"}</span>
            </span>
          </div>

          <div className="font-display text-lg tracking-widest text-white/50 uppercase">
            {activeMode === 'chat' && "// COMMAND_INTERFACE"}
            {activeMode === 'tasks' && "// EXECUTION_MATRIX"}
            {activeMode === 'settings' && "// SYSTEM_PARAMETERS"}
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 p-1">
            <div className="h-full w-full border border-[#00f3ff]/10 rounded-sm overflow-hidden relative bg-[#050505]/50 backdrop-blur-sm">
              {activeMode === 'chat' && (
                <ChatInterface
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                />
              )}
              {activeMode === 'tasks' && <TaskTree />}
              {activeMode === 'settings' && (
                <div className="h-full overflow-y-auto custom-scrollbar">
                  <Settings />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
