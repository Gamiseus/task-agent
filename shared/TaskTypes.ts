export interface TaskNode {
    id: string;
    title: string;
    description?: string;
    status: 'pending' | 'in-progress' | 'completed' | 'blocked';
    type: 'project' | 'main-task' | 'sub-task' | 'todo';
    children?: TaskNode[];
    expanded?: boolean;
}
