import { ipcMain, dialog } from 'electron';


import { AgentFileSystem } from './FileSystem';
import { WorkflowEngine } from './WorkflowEngine';
import { LLMService } from './LLMService';
import path from 'node:path';
import fs from 'fs-extra';

export class AgentManager {
    private fileSystem: AgentFileSystem | null = null;
    private workflow: WorkflowEngine | null = null;
    private projectPath: string | null = null;

    // State to track if agent loop is active
    private isRunning: boolean = false;

    constructor() {
        this.setupIPC();
    }

    private setupIPC() {
        console.log("AgentManager: Setting up IPC listeners");

        ipcMain.handle('agent:select-directory', async () => {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory', 'createDirectory']
            });
            if (result.canceled) return null;
            return result.filePaths[0];
        });

        ipcMain.handle('agent:init-project', async (_, projectPath: string) => {
            console.log(`AgentManager: Initializing project at ${projectPath}`);
            return this.initializeProject(projectPath);
        });

        ipcMain.handle('agent:run-step', async (_, stepId: number, inputs: any) => {
            console.log(`AgentManager: Running step ${stepId}`);
            return this.runStep(stepId, inputs);
        });

        ipcMain.handle('agent:get-tasks', async () => {
            if (this.projectPath) {
                const taskPath = path.join(this.projectPath, 'tasks.json');
                if (await fs.pathExists(taskPath)) {
                    return fs.readJSON(taskPath);
                }
            }
            return null;
        });

        ipcMain.handle('agent:get-status', () => {
            return { isRunning: this.isRunning, projectPath: this.projectPath };
        });

        ipcMain.handle('agent:chat', async (_, message: string) => {
            console.log(`AgentManager: Chat received: ${message}`);

            if (!this.workflow) {
                return {
                    id: Date.now().toString(),
                    role: 'agent',
                    content: "Error: Project not initialized. Please open a project first.",
                    timestamp: Date.now()
                };
            }

            try {
                const responseText = await this.workflow.processMessage(message);
                return {
                    id: Date.now().toString(),
                    role: 'agent',
                    content: responseText,
                    timestamp: Date.now()
                };
            } catch (error: any) {
                console.error("Workflow Error:", error);
                return {
                    id: Date.now().toString(),
                    role: 'agent',
                    content: "I encountered an error processing your request: " + error.message,
                    timestamp: Date.now()
                };
            }
        });



        ipcMain.handle('agent:get-models', async (_, provider: string, apiKey?: string) => {
            // Use existing workflow LLM if available
            if (this.workflow) {
                return this.workflow.getLLM().getAvailableModels(provider as any, apiKey);
            }

            // Fallback: Create temporary instance
            const tempService = new LLMService();
            return tempService.getAvailableModels(provider as any, apiKey);
        });

        ipcMain.handle('agent:configure-llm', async (_, config: { provider: string, modelId: string, apiKey?: string }) => {
            if (this.workflow && this.projectPath) {
                this.workflow.getLLM().configure(config.provider as any, config.modelId, config.apiKey);

                // Persist to settings.json
                try {
                    const settingsPath = path.join(this.projectPath, '.agent_workspace', 'settings.json');
                    const currentSettings = await fs.readJSON(settingsPath).catch(() => ({}));
                    await fs.writeJSON(settingsPath, {
                        ...currentSettings,
                        llm: config
                    }, { spaces: 2 });
                    return { success: true };
                } catch (e: any) {
                    return { success: false, error: "Failed to save settings: " + e.message };
                }
            }
            return { success: false, error: "Project not initialized" };
        });
    }

    async initializeProject(projectPath: string) {
        try {
            this.projectPath = projectPath;
            this.fileSystem = new AgentFileSystem(projectPath);
            await this.fileSystem.initialize();

            this.workflow = new WorkflowEngine(this.fileSystem);

            // Ensure .agent_workspace structure
            const workspacePath = path.join(projectPath, '.agent_workspace');
            await fs.ensureDir(path.join(workspacePath, 'history'));
            await fs.ensureDir(path.join(workspacePath, 'snapshots'));

            // Create settings if not exists
            const settingsPath = path.join(workspacePath, 'settings.json');
            if (!await fs.pathExists(settingsPath)) {
                await fs.writeJSON(settingsPath, {
                    created: Date.now(),
                    agentMode: 'default'
                }, { spaces: 2 });
            } else {
                // Load existing settings
                try {
                    const settings = await fs.readJSON(settingsPath);
                    if (settings.llm) {
                        console.log("Restoring LLM Config from settings");
                        this.workflow.getLLM().configure(
                            settings.llm.provider,
                            settings.llm.modelId,
                            settings.llm.apiKey
                        );
                    }
                } catch (e) {
                    console.error("Error loading settings:", e);
                }
            }

            return { success: true };
        } catch (error: any) {
            console.error("Failed to initialize project:", error);
            return { success: false, error: error.message };
        }
    }

    async runStep(stepId: number, _inputs: any) {
        if (!this.fileSystem) {
            throw new Error("Project not initialized");
        }

        this.isRunning = true;
        try {
            // Placeholder: This is where we will hook up the LangChain/AI logic later
            // For now, we simulate success
            await new Promise(resolve => setTimeout(resolve, 1000));

            return { success: true, message: `Step ${stepId} executed` };
        } catch (error: any) {
            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
        }
    }
}

export const agentManager = new AgentManager();
