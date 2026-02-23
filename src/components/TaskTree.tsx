import { useState, useEffect } from 'react';

interface TaskNode {
    id: string;
    title: string;
    status: 'pending' | 'in-progress' | 'completed' | 'blocked';
    type: 'project' | 'main-task' | 'sub-task' | 'todo' | 'step';
    children?: TaskNode[];
    expanded?: boolean;
}

export function TaskTree() {
    const [data, setData] = useState<TaskNode | null>(null);

    useEffect(() => {
        const loadTasks = async () => {
            try {
                // @ts-ignore
                const tasks = await window.ipcRenderer.invoke('agent:get-tasks');
                if (tasks) {
                    setData(tasks);
                }
            } catch (e) {
                console.error("Failed to load tasks", e);
            }
        };

        loadTasks();
        const interval = setInterval(loadTasks, 3000);
        return () => clearInterval(interval);
    }, []);

    if (!data) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center font-mono opacity-60">
                    <div className="text-[#00f3ff] text-4xl mb-4 animate-pulse">⎈</div>
                    <p className="text-[#00f3ff] text-sm tracking-widest uppercase mb-2">No Mission Data</p>
                    <p className="text-gray-500 text-xs">Initialize project via Command Interface</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
            {/* Background Grid Decoration */}
            <div className="absolute inset-0 pointer-events-none opacity-5"
                style={{ backgroundImage: 'linear-gradient(#00f3ff 1px, transparent 1px), linear-gradient(90deg, #00f3ff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            </div>

            <div className="max-w-4xl mx-auto relative z-10">
                <div className="flex items-center space-x-4 mb-8 border-b border-[#00f3ff]/20 pb-4">
                    <div className="w-3 h-3 bg-[#00f3ff] shadow-[0_0_10px_#00f3ff]"></div>
                    <h3 className="text-xl font-display tracking-widest text-white uppercase">Execution Matrix</h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#00f3ff]/50 to-transparent"></div>
                </div>

                <div className="pl-4">
                    <TaskItem node={data} level={0} />
                </div>
            </div>
        </div>
    );
}

const StatusBadge = ({ status }: { status: TaskNode['status'] }) => {
    const styles: Record<string, string> = {
        'pending': 'text-gray-500 border-gray-700',
        'in-progress': 'text-amber-400 border-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.2)] animate-pulse',
        'completed': 'text-[#00ff9d] border-[#00ff9d] shadow-[0_0_8px_rgba(0,255,157,0.2)]',
        'blocked': 'text-red-500 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
    };

    return (
        <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 border ${styles[status] || styles['pending']}`}>
            {status}
        </span>
    );
};

const TypeIcon = ({ type }: { type: TaskNode['type'] }) => {
    const icons: Record<string, string> = {
        'project': '◉', // Fisheye
        'main-task': '⬢', // Hexagon
        'sub-task': '⬡', // Hexagon Outline
        'todo': '▹',
        'step': '·'
    };
    return <span className="mr-3 text-xs opacity-70 w-4 text-center">{icons[type] || '•'}</span>;
};

const TaskItem = ({ node, level, isLast = true }: { node: TaskNode, level: number, isLast?: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(level < 2);
    const hasChildren = node.children && node.children.length > 0;

    // Circuit Line Logic
    const isRoot = level === 0;

    return (
        <div className="relative font-mono">
            {/* Horizontal connection line for children */}
            {!isRoot && (
                <div className="absolute top-4 -left-6 w-6 h-px bg-[#00f3ff]/20">
                    <div className="absolute right-0 top-[-2px] w-1 h-1 bg-[#00f3ff]/40 rounded-full"></div>
                </div>
            )}

            {/* Vertical connection line from parent */}
            {!isRoot && !isLast && (
                <div className="absolute top-0 bottom-0 -left-6 w-px bg-[#00f3ff]/20"></div>
            )}

            <div className="mb-2">
                <div
                    className={`
                        group flex items-center py-2 px-3 border border-transparent
                        transition-all duration-300 cursor-pointer select-none
                        ${isRoot ? 'mb-6' : 'mb-1'}
                        ${node.status === 'in-progress' ? 'bg-[#00f3ff]/5 border-[#00f3ff]/30' : 'hover:bg-[#00f3ff]/5 hover:border-[#00f3ff]/20'}
                        ${node.status === 'completed' ? 'opacity-60' : 'opacity-100'}
                    `}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {/* Expand Toggle */}
                    <span className={`w-4 text-[10px] text-[#00f3ff] mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''} ${!hasChildren ? 'opacity-0' : ''}`}>
                        ▶
                    </span>

                    <TypeIcon type={node.type} />

                    <span className={`flex-1 text-sm tracking-wide ${node.status === 'completed' ? 'text-gray-500 line-through decoration-[#00ff9d]/30' : 'text-gray-200 group-hover:text-[#00f3ff]'}`}>
                        {node.title}
                    </span>

                    <StatusBadge status={node.status} />
                </div>

                {isExpanded && hasChildren && (
                    <div className={`
                        relative ml-6 pl-0
                        ${isRoot ? 'border-l border-[#00f3ff]/20' : ''} 
                    `}>
                        {/* If root, we use a continuous border. If nested, we draw lines per item via CSS in the children */}
                        {node.children!.map((child, index) => (
                            <TaskItem
                                key={child.id}
                                node={child}
                                level={level + 1}
                                isLast={index === node.children!.length - 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

