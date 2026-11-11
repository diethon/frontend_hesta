/**
 * Voice API Service — gọi voice-service Python HTTP server
 * để xử lý lệnh voice dạng text.
 */

export const VOICE_SERVICE_URL = import.meta.env.VITE_VOICE_SERVICE_URL?.trim() || 'http://localhost:8001';

export interface VoiceCommandRequest {
  text: string;
  homeId: string;
}

export interface SubCommandResult {
  message: string;
  success: boolean;
  action: string | null;
  room: string | null;
  deviceType: string | null;
}

export interface VoiceCommandResponse {
  success: boolean;
  message: string;
  transcript: string;
  action: string | null;
  room: string | null;
  deviceType: string | null;
  totalDurationMs: number;
  stepDurations: Record<string, number>;
  audioUrl?: string | null;
  audioData?: string | null;
  subCommands?: SubCommandResult[];
}

/**
 * Trả về URL audio phát giọng nói tiếng Việt từ Server Neural TTS (Hoài My).
 */
export function getTtsAudioUrl(text: string): string {
  return `${VOICE_SERVICE_URL}/api/voice/tts?text=${encodeURIComponent(text.trim())}`;
}

/**
 * Gửi lệnh voice (dạng text) tới voice-service để xử lý.
 * Frontend dùng Web Speech API chuyển giọng → text, rồi gửi text về đây.
 */
export async function processVoiceCommand(request: VoiceCommandRequest): Promise<VoiceCommandResponse> {
  const response = await fetch(`${VOICE_SERVICE_URL}/api/voice/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Voice service error: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

/**
 * Kiểm tra voice service có đang hoạt động không.
 */
export async function checkVoiceServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${VOICE_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.pipelineReady === true;
  } catch {
    return false;
  }
}
