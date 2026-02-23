import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { BaseMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama';

export interface ModelInfo {
    id: string;
    name: string; // Human readable or same as ID
    provider: LLMProvider;
}

export class LLMService {
    private model: BaseChatModel | null = null;
    private currentProvider: LLMProvider | null = null;

    constructor() {
        // Default to Mock/Null until configured
    }

    /**
     * Configures the active LLM Model
     */
    configure(provider: LLMProvider, modelId: string, apiKey?: string) {
        this.currentProvider = provider;

        switch (provider) {
            case 'openai':
                this.model = new ChatOpenAI({
                    openAIApiKey: apiKey,
                    modelName: modelId
                });
                break;
            case 'anthropic':
                this.model = new ChatAnthropic({
                    anthropicApiKey: apiKey,
                    model: modelId
                });
                break;
            case 'google':
                this.model = new ChatGoogleGenerativeAI({
                    apiKey: apiKey,
                    model: modelId,
                    maxRetries: 1 // Prevent infinite retry loops on free tier
                });
                break;
            case 'ollama':
                this.model = new ChatOllama({
                    baseUrl: "http://localhost:11434", // Default
                    model: modelId
                });
                break;
        }
        console.log(`LLMService: Configured for ${provider} with model ${modelId}`);
    }

    async chat(messages: BaseMessage[]): Promise<string> {
        if (!this.model) {
            console.warn("LLMService: No Provider Configured. Using Mock response.");
            const lastMsg = messages[messages.length - 1].content.toString();
            return `[MOCK AI - No Provider Set] I heard: "${lastMsg}". \n\nPlease configure a provider (OpenAI, Anthropic, Google, or Ollama) to continue.`;
        }

        try {
            console.log(`LLMService: Sending chat request to ${this.currentProvider}`);

            // Preprocess messages for Google Gemini compatibility
            // Google requires: SystemMessage first (optional), then alternating Human/AI
            let processedMessages = messages;

            if (this.currentProvider === 'google') {
                console.log("LLMService: Preprocessing messages for Google...");
                processedMessages = this.preprocessForGoogle(messages);
                console.log("LLMService: Google Messages structure:", JSON.stringify(processedMessages.map(m => ({ type: m.getType(), contentLength: m.content.toString().length })), null, 2));
            }

            console.log("LLMService: Invoking model (STREAMING MODE)...");

            // Add 60s timeout to prevent infinite hangs
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timed out after 60 seconds")), 60000)
            );

            // Use streaming to detect partial progress
            const streamPromise = (async () => {
                const stream = await this.model!.stream(processedMessages);
                let fullContent = "";
                let chunkCount = 0;

                for await (const chunk of stream) {
                    const chunkText = chunk.content.toString();
                    fullContent += chunkText;
                    chunkCount++;
                    // Log first few chunks to verify data flow
                    if (chunkCount <= 3) {
                        console.log(`LLMService: Received chunk ${chunkCount}:`, chunkText.substring(0, 20) + "...");
                    }
                }
                console.log(`LLMService: Stream complete. Total chunks: ${chunkCount}`);
                return fullContent;
            })();

            const result = await Promise.race([streamPromise, timeoutPromise]);
            return result as string;

        } catch (error: any) {
            console.error("LLM Execution Error:", error);
            return `Error connecting to ${this.currentProvider}: ${error.message}`;
        }
    }

    /**
     * Google Gemini has strict message ordering requirements:
     * - System message must be first (if present)
     * - Only one system message is allowed
     * - After system, must be alternating Human/AI messages
     */
    private preprocessForGoogle(messages: BaseMessage[]): BaseMessage[] {
        // Separate system messages and conversation messages
        const systemMessages: BaseMessage[] = [];
        const conversationMessages: BaseMessage[] = [];

        for (const msg of messages) {
            if (msg.getType() === 'system') {
                systemMessages.push(msg);
            } else {
                conversationMessages.push(msg);
            }
        }

        // Combine all system messages into one (or take the last one)
        let combinedSystemContent = systemMessages.map(m => m.content).join('\n\n');

        // Build the result array
        const result: BaseMessage[] = [];

        // Add combined system message first
        if (combinedSystemContent) {
            result.push(new SystemMessage(combinedSystemContent));
        }

        // Add conversation messages, converting any remaining SystemMessages to AIMessages
        for (const msg of conversationMessages) {
            const type = msg.getType();
            if (type === 'human') {
                result.push(msg);
            } else if (type === 'ai' || type === 'system') {
                // Treat any non-human message as AI response
                result.push(new AIMessage(msg.content.toString()));
            } else {
                result.push(msg);
            }
        }

        return result;
    }


    /**
     * Fetches available models from the specified provider API
     */
    async getAvailableModels(provider: LLMProvider, apiKey?: string): Promise<ModelInfo[]> {
        const models: ModelInfo[] = [];

        try {
            switch (provider) {
                case 'openai': {
                    if (!apiKey) throw new Error("API Key required for OpenAI");
                    const res = await fetch('https://api.openai.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    if (!res.ok) throw new Error(`OpenAI API Error: ${res.statusText}`);
                    const data = await res.json();

                    data.data.forEach((m: any) => {
                        // Filter for likely chat models
                        if (m.id.includes('gpt')) {
                            models.push({ id: m.id, name: m.id, provider: 'openai' });
                        }
                    });
                    break;
                }
                case 'anthropic': {
                    if (!apiKey) throw new Error("API Key required for Anthropic");
                    const res = await fetch('https://api.anthropic.com/v1/models', {
                        headers: {
                            'x-api-key': apiKey,
                            'anthropic-version': '2023-06-01'
                        }
                    });
                    if (!res.ok) throw new Error(`Anthropic API Error: ${res.statusText}`);
                    const data = await res.json();
                    data.data.forEach((m: any) => {
                        models.push({ id: m.id, name: m.display_name || m.id, provider: 'anthropic' });
                    });
                    break;
                }
                case 'google': {
                    if (!apiKey) throw new Error("API Key required for Google");
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                    if (!res.ok) throw new Error(`Google API Error: ${res.statusText}`);
                    const data = await res.json();
                    // Google returns "models/gemini-pro", strip prefix for cleaner names if needed, 
                    // or keep as ID. LangChain usually expects "gemini-pro".
                    // Google list returns: { models: [ { name: "models/gemini-1.0-pro", ... } ] }
                    if (data.models) {
                        data.models.forEach((m: any) => {
                            const id = m.name.replace('models/', '');
                            models.push({ id: id, name: m.displayName || id, provider: 'google' });
                        });
                    }
                    break;
                }
                case 'ollama': {
                    const res = await fetch('http://localhost:11434/api/tags');
                    if (!res.ok) throw new Error(`Ollama API Error: ${res.statusText}`);
                    const data = await res.json();
                    // Ollama returns { models: [ { name: "llama3:latest", ... } ] }
                    data.models.forEach((m: any) => {
                        models.push({ id: m.name, name: m.name, provider: 'ollama' });
                    });
                    break;
                }
            }
        } catch (error: any) {
            console.error(`Failed to fetch models for ${provider}:`, error);
            // Return empty list or throw depending on UI needs. 
            // Here we basically rely on the caller to handle empty lists or errors.
            throw error;
        }

        return models;
    }
}
