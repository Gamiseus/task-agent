import { LLMService } from "./LLMService";
import { AgentFileSystem } from "./FileSystem";
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

export enum WorkflowStep {
    INITIATION = 1,
    TASK_GENERATION = 2,
    DECOMPOSITION = 3,
    ANALYSIS = 4,
    COORDINATION = 5,
    PLANNING = 6,
    EXECUTION = 7,
    COMPLETED = 8
}

interface TaskNode {
    id: string;
    title: string;
    status: 'pending' | 'in-progress' | 'completed' | 'blocked';
    type: 'project' | 'main-task' | 'sub-task' | 'todo' | 'step';
    children?: TaskNode[];
    decomposed?: boolean; // Track if this task has been decomposed
}

interface ProjectContext {
    name: string;
    description: string;
    requirements: string[];
    chatHistory: BaseMessage[];
}

export class WorkflowEngine {
    private llm: LLMService;
    private fs: AgentFileSystem;

    private currentStep: WorkflowStep = WorkflowStep.INITIATION;
    private context: ProjectContext;
    private isDecomposing: boolean = false;

    constructor(fileSystem: AgentFileSystem) {
        this.fs = fileSystem;
        this.llm = new LLMService();
        this.context = {
            name: "Untitled Project",
            description: "",
            requirements: [],
            chatHistory: []
        };
    }

    getLLM(): LLMService {
        return this.llm;
    }

    async processMessage(userMessage: string): Promise<string> {
        // 1. Add user message to history
        this.context.chatHistory.push(new HumanMessage(userMessage));

        // 2. Determine action based on step
        let response = "";
        switch (this.currentStep) {
            case WorkflowStep.INITIATION:
                response = await this.handleInitiationStep();
                break;
            case WorkflowStep.TASK_GENERATION:
                response = "I am generating the initial task list...";
                break;
            case WorkflowStep.DECOMPOSITION:
                response = await this.handleDecompositionStep();
                break;
            default:
                response = "I am not ready for step " + this.currentStep + " yet.";
        }

        // 3. Add AI response to history (as AIMessage, not SystemMessage)
        this.context.chatHistory.push(new AIMessage(response));

        // 4. Save Context (Async)
        this.saveContext();

        return response;
    }

    private async handleInitiationStep(): Promise<string> {
        const lastUserMsg = this.context.chatHistory[this.context.chatHistory.length - 1].content.toString().toLowerCase();

        if (lastUserMsg.includes("yes") || lastUserMsg.includes("proceed") || lastUserMsg.includes("looks good")) {
            this.currentStep = WorkflowStep.TASK_GENERATION;
            return await this.generateHighLevelTasks();
        }

        const systemPrompt = `You are an **Agentic Project Manager AI** guiding the user through a multi-step autonomous project planning process.

## The 7-Step Process (You Are on Step 1)
1. **Initiation** (CURRENT) - Interview the user about their project.
2. **Task Generation** - Convert requirements into high-level tasks.
3. **Decomposition** - Break tasks into actionable sub-tasks.
4. **Analysis** - Evaluate dependencies and complexity.
5. **Coordination** - Plan parallel execution opportunities.
6. **Planning** - Generate implementation steps for each task.
7. **Execution** - (Future) The agent autonomously writes code.

## Your Role (Step 1: Initiation)
- Ask clarifying questions about the user's **project idea**.
- Focus on:
  - What is the goal of the project?
  - What technologies or platforms are involved (if any)?
  - What are the core features or components?
- **DO NOT** ask about implementation details, formatting, file structures, or code specifics. Those will be addressed automatically in later steps.

## Current Knowledge
- Project Name: ${this.context.name}
- Description: ${this.context.description || "Not yet defined"}

## Instructions
- Use **Markdown formatting** (**bold**, lists) for readability.
- Keep responses concise (2-4 sentences max per point).
- When you have enough information (project goal, scope, and key features), **summarize** and ask:
  > "I have a good understanding. Ready to proceed to **Step 2: Task Generation**?"
- When the user confirms (e.g., "yes", "proceed"), end the conversation.`;

        const messages = [
            new SystemMessage(systemPrompt),
            ...this.context.chatHistory.slice(-10)
        ];

        return this.llm.chat(messages);
    }

    private async generateHighLevelTasks(): Promise<string> {
        const prompt = `Based on our conversation, generate a JSON structure for the project tasks.
        
        Project Context:
        ${this.context.chatHistory.map(m => m.getType() + ": " + m.content).join("\n")}

        
        Output MUST be a valid JSON object matching this interface:
        {
            "id": "root",
            "title": "Project Name",
            "type": "project",
            "status": "pending",
            "children": [
                { "id": "1", "title": "Main Task 1", "type": "main-task", "status": "pending", "children": [] }
            ]
        }
        
        Create high-level "main-task" items, which are purely large scale and broad in scope, meant to act more like categories or sections of tasks and task types. Do not go deeper than main-task levels yet.
        Return ONLY valid JSON. No markdown formatting.`;

        const messages = [new HumanMessage(prompt)];
        const response = await this.llm.chat(messages);

        try {
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const projectNode = JSON.parse(cleanJson);

            const taskFile = "tasks.json";
            await this.fs.writeSafe(taskFile, JSON.stringify(projectNode, null, 2));

            this.currentStep = WorkflowStep.DECOMPOSITION;

            return `**Step 2 Complete!** I've generated the initial project structure.

**Project:** ${projectNode.title}
**Tasks Created:** ${projectNode.children?.length || 0} high-level tasks

Check the **Task Tree** view to see the structure.

---

**Ready for Step 3: Decomposition?**
This will break each task into actionable sub-tasks. Type **"decompose"** or **"yes"** to begin.`;
        } catch (e: any) {
            console.error("Failed to parse task JSON", e);
            return "I tried to generate tasks but failed to parse the output. Let's try again.";
        }
    }

    // ============================================
    // STEP 3: DECOMPOSITION
    // ============================================

    private async handleDecompositionStep(): Promise<string> {
        const lastUserMsg = this.context.chatHistory[this.context.chatHistory.length - 1].content.toString().toLowerCase();

        // Check for confirmation to start decomposition
        if (lastUserMsg.includes("decompose") || lastUserMsg.includes("yes") || lastUserMsg.includes("proceed") || lastUserMsg.includes("break")) {
            if (this.isDecomposing) {
                return "Decomposition is already in progress. Please wait...";
            }
            return await this.runDecomposition();
        }

        // Check for skip/next
        if (lastUserMsg.includes("skip") || lastUserMsg.includes("next")) {
            this.currentStep = WorkflowStep.ANALYSIS;
            return "Skipping decomposition. Moving to **Step 4: Analysis**.";
        }

        return `We're now in **Step 3: Decomposition**.

I will analyze each high-level task and break it down into actionable sub-tasks.

**Options:**
- Type **"decompose"** or **"yes"** to start automatic decomposition
- Type **"skip"** to move to the next step

What would you like to do?`;
    }

    private async runDecomposition(): Promise<string> {
        this.isDecomposing = true;

        try {
            // Read current tasks
            const tasksJson = await this.fs.readFile("tasks.json");
            if (!tasksJson) {
                return "No tasks.json found. Please complete Step 2 first.";
            }

            const rootTask: TaskNode = JSON.parse(tasksJson);

            // Find all main-tasks that need decomposition
            const tasksToDecompose = this.findTasksToDecompose(rootTask);

            if (tasksToDecompose.length === 0) {
                this.currentStep = WorkflowStep.ANALYSIS;
                return "All tasks are already decomposed! Moving to **Step 4: Analysis**.";
            }

            let decomposedCount = 0;
            const results: string[] = [];

            // Decompose each task with delay to prevent rate limiting
            for (let i = 0; i < tasksToDecompose.length; i++) {
                const task = tasksToDecompose[i];

                // Add delay between requests (except for first one)
                if (i > 0) {
                    await this.sleep(1500); // 1.5 second delay
                }

                try {
                    console.log(`Decomposing task ${i + 1}/${tasksToDecompose.length}: ${task.title}`);
                    const subTasks = await this.decomposeTask(task, rootTask.title);
                    if (subTasks.length > 0) {
                        task.children = subTasks;
                        task.decomposed = true;
                        decomposedCount++;
                        results.push(`✅ **${task.title}** → ${subTasks.length} sub-tasks`);
                    }
                } catch (e: any) {
                    console.error(`Failed to decompose ${task.title}:`, e);
                    results.push(`⚠️ **${task.title}** - Failed: ${e.message}`);
                }
            }

            // Save updated tasks
            await this.fs.writeSafe("tasks.json", JSON.stringify(rootTask, null, 2));

            this.isDecomposing = false;
            this.currentStep = WorkflowStep.ANALYSIS;

            return `**Decomposition Complete!**

${results.join("\n")}

---

**${decomposedCount}** tasks were broken down into sub-tasks. Check the **Task Tree** to see the updated structure.

Moving to **Step 4: Analysis**. Type **"analyze"** to continue.`;

        } catch (e: any) {
            this.isDecomposing = false;
            console.error("Decomposition error:", e);
            return `Error during decomposition: ${e.message}`;
        }
    }

    private findTasksToDecompose(node: TaskNode, results: TaskNode[] = []): TaskNode[] {
        // Only decompose main-tasks that haven't been decomposed yet
        if (node.type === 'main-task' && !node.decomposed && (!node.children || node.children.length === 0)) {
            results.push(node);
        }

        // Recurse into children
        if (node.children) {
            for (const child of node.children) {
                this.findTasksToDecompose(child, results);
            }
        }

        return results;
    }

    private async decomposeTask(task: TaskNode, projectName: string): Promise<TaskNode[]> {
        const prompt = `You are decomposing a task into actionable sub-tasks.

**Project:** ${projectName}
**Task to Decompose:** ${task.title}

Break this task into 2-5 specific, actionable sub-tasks. Each sub-task should be something a developer could complete in a focused work session.

Output ONLY a valid JSON array of sub-tasks:
[
    { "id": "${task.id}-1", "title": "Sub-task title", "type": "sub-task", "status": "pending", "children": [] }
]

Rules:
- Each sub-task should be specific and actionable
- Use descriptive titles that explain what needs to be done
- Keep the "type" as "sub-task"
- All "status" should be "pending"
- Return ONLY valid JSON, no markdown`;

        const messages = [new HumanMessage(prompt)];
        const response = await this.llm.chat(messages);

        try {
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const subTasks: TaskNode[] = JSON.parse(cleanJson);
            return subTasks;
        } catch (e) {
            console.error(`Failed to parse sub-tasks for ${task.title}:`, e);
            throw new Error("Failed to parse LLM response");
        }
    }

    private async saveContext() {
        // Save to .agent_workspace/context.json (placeholder)
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

