import fs from 'fs-extra';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

export class AgentFileSystem {
    private projectRoot: string;
    private backupDir: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        this.backupDir = path.join(projectRoot, '.agent_workspace', 'backups');
    }

    async initialize() {
        await fs.ensureDir(this.backupDir);
    }

    /**
     * Writes content to a file, creating a backup of the original if it exists.
     */
    async writeSafe(relativePath: string, content: string) {
        const fullPath = path.join(this.projectRoot, relativePath);
        
        // Backup if exists
        if (await fs.pathExists(fullPath)) {
            const fileName = path.basename(relativePath);
            const timestamp = Date.now();
            const backupName = `${timestamp}_${uuidv4()}_${fileName}`;
            await fs.copy(fullPath, path.join(this.backupDir, backupName));
        } else {
            // Ensure parent dir exists
            await fs.ensureDir(path.dirname(fullPath));
        }

        await fs.writeFile(fullPath, content, 'utf-8');
        return fullPath;
    }

    async readFile(relativePath: string): Promise<string> {
        return fs.readFile(path.join(this.projectRoot, relativePath), 'utf-8');
    }

    async listFiles(dirPath: string): Promise<string[]> {
        const fullPath = path.join(this.projectRoot, dirPath);
        if (!await fs.pathExists(fullPath)) return [];
        return fs.readdir(fullPath);
    }
}
