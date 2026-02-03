/**
 * Chrome Built-in AI (Gemini Nano) Service
 * Wraps the experimental window.ai API
 */

export interface AIParticipantContribution {
  name: string;
  contributions: string[];
  suggested_ratio: number;
  reasoning: string;
}

export interface AIAnalysisResult {
  participants: AIParticipantContribution[];
  summary: string;
  sentiment_score: number;
}

declare global {
  interface Window {
    ai?: {
      languageModel: {
        capabilities: () => Promise<{ available: 'readily' | 'after-download' | 'no' }>;
        create: (options?: { systemPrompt?: string }) => Promise<AILanguageModelSession>;
      };
    };
  }
  // New Chrome API - LanguageModel is directly on globalThis
  var LanguageModel: {
    availability: () => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
    create: (options?: { systemPrompt?: string }) => Promise<AILanguageModelSession>;
  } | undefined;
}

interface AILanguageModelSession {
  prompt: (text: string) => Promise<string>;
  promptStreaming: (text: string) => AsyncIterable<string>;
  destroy: () => void;
}

// Helper to get the language model API (supports both old and new Chrome API)
function getLanguageModelAPI() {
  // Try new API first (LanguageModel global)
  if (typeof LanguageModel !== 'undefined') {
    return {
      checkAvailability: async () => {
        const status = await LanguageModel!.availability();
        if (status === 'available') return { available: 'readily' as const };
        if (status === 'downloadable' || status === 'downloading') return { available: 'after-download' as const };
        return { available: 'no' as const };
      },
      create: (options?: { systemPrompt?: string }) => LanguageModel!.create(options)
    };
  }
  // Fall back to old API (window.ai.languageModel)
  if (window.ai?.languageModel) {
    return {
      checkAvailability: () => window.ai!.languageModel.capabilities(),
      create: (options?: { systemPrompt?: string }) => window.ai!.languageModel.create(options)
    };
  }
  return null;
}

export class LLMService {
  private session: AILanguageModelSession | null = null;

  /**
   * Check if Chrome AI is supported and ready
   */
  async checkSupport(): Promise<{ supported: boolean; message: string }> {
    const api = getLanguageModelAPI();
    if (!api) {
      return {
        supported: false,
        message: 'Your browser does not support Chrome Built-in AI. Please use Chrome Canary or Dev channel and enable "Prompt API for Gemini Nano".'
      };
    }

    try {
      const capabilities = await api.checkAvailability();
      if (capabilities.available === 'no') {
        return { supported: false, message: 'AI model is not available on this device.' };
      }
      if (capabilities.available === 'after-download') {
        return { supported: true, message: 'Model needs to be downloaded first (this happens automatically).' };
      }
      return { supported: true, message: 'Ready to use.' };
    } catch (e) {
      console.error('Failed to check AI capabilities:', e);
      return { supported: false, message: 'Error checking AI capabilities.' };
    }
  }

  /**
   * Initialize the model session
   */
  async init() {
    const api = getLanguageModelAPI();
    if (!this.session && api) {
      const systemPrompt = `
You are an expert project manager. Analyze meeting transcripts to identify contributions.
Return ONLY valid JSON.
Output format:
{
  "participants": [
    { "name": "Name", "contributions": ["Task 1"], "suggested_ratio": 25.0, "reasoning": "Reason..." }
  ],
  "summary": "Brief summary",
  "sentiment_score": 0.8
}
`;
      this.session = await api.create({ systemPrompt });
    }
  }

  /**
   * Analyze meeting transcript
   */
  async analyzeMeeting(transcript: string): Promise<AIAnalysisResult> {
    if (!this.session) await this.init();
    if (!this.session) throw new Error("AI session not initialized");

    const prompt = `
Analyze this meeting summary. Identify participants, their specific contributions, and assign a contribution ratio (0-100) based on value.
Total ratio must equal 100.
Also provide a brief summary and sentiment score (0-1).

Transcript:
${transcript}

Return JSON only.
`;

    try {
      const resultStr = await this.session.prompt(prompt);

      // Clean up markdown code blocks if present
      const jsonStr = resultStr.replace(/```json/g, "").replace(/```/g, "").trim();

      console.log('AI Raw Response:', resultStr);
      console.log('AI Parsed JSON:', jsonStr);

      const rawResult = JSON.parse(jsonStr);
      console.log('AI Result Object:', rawResult);

      // Normalize the result - AI might use different field names
      const result: AIAnalysisResult = {
        participants: (rawResult.participants || []).map((p: any) => ({
          name: p.name || p.participant || 'Unknown',
          contributions: p.contributions || p.tasks || [],
          // Handle different possible field names for ratio
          suggested_ratio: p.suggested_ratio ?? p.ratio ?? p.contribution_ratio ?? p.percentage ?? 0,
          reasoning: p.reasoning || p.reason || p.justification || ''
        })),
        summary: rawResult.summary || rawResult.meeting_summary || '',
        sentiment_score: rawResult.sentiment_score ?? rawResult.sentiment ?? 0.5
      };

      console.log('Normalized Result:', result);
      console.log('Participants with ratios:', result.participants.map(p => ({ name: p.name, ratio: p.suggested_ratio })));

      // Normalize ratios
      const total = result.participants.reduce((sum, p) => sum + p.suggested_ratio, 0);
      if (Math.abs(total - 100) > 1 && total > 0) {
        result.participants.forEach(p => {
          p.suggested_ratio = parseFloat(((p.suggested_ratio / total) * 100).toFixed(2));
        });
      }

      return result;
    } catch (e) {
      console.error("AI Analysis failed:", e);
      throw new Error("Failed to analyze meeting with AI. Make sure the model is loaded.");
    }
  }

  destroy() {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
  }
}

export const llmService = new LLMService();
