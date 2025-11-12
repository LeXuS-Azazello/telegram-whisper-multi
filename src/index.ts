// Telegram userbot for parsing only private incoming voice messages with configurable transcription modes
// OOP refactor: VoiceTranscriber handles transcription logic, TelegramUserbot manages client and events
// Supports: local (Whisper-node + FFmpeg), api (WhisperAPI.com), deepgram (Deepgram API)
// Switch via WHISPER_MODE in .env (default: 'api')
// Fixed: Unique file names with msgId for all modes to avoid concurrency issues

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
//import * as input from "input";
const input = require("input");
import env from "dotenv";
env.config();
import * as fs from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";
//import { promisify } from "util";
//import { whisper } from "whisper-node"; // For local mode
const { whisper } = require("whisper-node");
const apiId = parseInt(process.env.TG_API_ID as string, 10);
const apiHash = process.env.TG_API_HASH as string;
const stringSession = new StringSession(process.env.TG_SESSION as string);

// External libs for API modes
//const fetch = require("node-fetch");
const FormData = require("form-data");

// Promisify spawn for async FFmpeg in local mode
//const execAsync = promisify(spawn);

/**
 * Class for handling voice message transcription based on configured mode
 * Manages local Whisper, WhisperAPI.com, or Deepgram with retry logic
 */
class VoiceTranscriber {
  private readonly mode: string;
  private readonly modelSize: string;
  private readonly modelDir: string | undefined;
  private readonly whisperApiKey: string;
  private readonly deepgramKey: string;
  private readonly retries: number = 3;

  constructor() {
    this.mode = process.env.WHISPER_MODE || "local";
    this.modelSize = process.env.WHISPER_MODEL_SIZE || "base";
    this.whisperApiKey = process.env.WHISPER_API_KEY as string;
    this.deepgramKey = process.env.DEEPGRAM_KEY as string;
    this.modelDir = process.env.WHISPER_MODEL_DIR || "/app/models";
    // Validate based on mode
    console.log(this.whisperApiKey);
    if (this.mode === "api" && !this.whisperApiKey) {
      throw new Error("WHISPER_API_KEY is required for api mode");
    }
    if (this.mode === "deepgram" && !this.deepgramKey) {
      throw new Error("DEEPGRAM_KEY is required for deepgram mode");
    }
    if (this.mode === "local" && this.modelDir) {
      console.log(`Local mode: Using model dir ${this.modelDir}`);
    }
  }

  /**
   * Checks if FFmpeg is available (for local mode)
   * @returns Promise that resolves to boolean
   */
  private async isFfmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const ffmpegCheck = spawn("ffmpeg", ["-version"], { stdio: "pipe" });
      ffmpegCheck.on("close", (code) => resolve(code === 0));
      ffmpegCheck.on("error", () => resolve(false));
    });
  }

  /**
   * Converts OGG to WAV using FFmpeg (for local mode)
   * @param inputPath - Path to input OGG file
   * @param outputPath - Path to output WAV file
   * @returns Promise that resolves when conversion is done
   */
  private async convertToWav(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-i",
          inputPath,
          "-ar",
          "16000",
          "-ac",
          "1", // Mono for Whisper
          "-y", // Overwrite output file
          outputPath,
        ],
        { stdio: "inherit" }
      );

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg conversion failed with code ${code}`));
        }
      });

      ffmpeg.on("error", reject);
    });
  }

  /**
   * Performs API call with retry logic
   * @param apiCall - Function that makes the API request
   * @returns Promise<string> - The transcribed text
   */
  private async withRetry<T>(
    apiCall: () => Promise<T>,
    retries: number = this.retries
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        console.error(`API attempt ${attempt} failed:`, error);
        if (attempt === retries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Backoff
      }
    }
    throw new Error("Retry limit exceeded");
  }

  /**
   * Transcribes audio using WhisperAPI.com
   * @param audioBuffer - The OGG audio buffer
   * @returns Promise<string> - The transcribed text
   */
  private async transcribeWhisperAPI(audioBuffer: Buffer): Promise<string> {
    const formData = new FormData();
    formData.append("file", audioBuffer, {
      filename: "voice.ogg",
      contentType: "audio/ogg",
    });
    formData.append("model_size", this.modelSize);
    formData.append("language", "auto");
    formData.append("format", "json");

    const response = await fetch("https://api.whisper-api.com/transcribe", {
      method: "POST",
      headers: { "X-API-Key": this.whisperApiKey, ...formData.getHeaders() },
      body: formData,
    });

    if (!response.ok)
      throw new Error(`WhisperAPI failed: ${response.statusText}`);
    const data = await response.json();
    return data.transcript || "Transcription empty";
  }

  /**
   * Transcribes audio using Deepgram API
   * @param audioBuffer - The OGG audio buffer
   * @returns Promise<string> - The transcribed text
   */
  private async transcribeDeepgram(audioBuffer: Buffer): Promise<string> {
    const response = await fetch("https://api.deepgram.com/v1/listen", {
      method: "POST",
      headers: {
        Authorization: `Token ${this.deepgramKey}`,
        "Content-Type": "audio/ogg",
      },
      body: new Uint8Array(audioBuffer),
    });

    if (!response.ok)
      throw new Error(`Deepgram failed: ${response.statusText}`);
    const data = await response.json();
    return data.channel?.alternatives?.[0]?.transcript || "Transcription empty";
  }

  /**
   * Transcribes using local Whisper (with FFmpeg conversion)
   * @param audioBuffer - The OGG audio buffer
   * @param msgId - Message ID for unique file naming
   * @returns Promise<{ text: string; conversionTime: number }> - Transcribed text and conversion time
   */
  private async transcribeLocal(
    audioBuffer: Buffer,
    msgId: number
  ): Promise<{ text: string; conversionTime: number }> {
    const ffmpegAvailable = await this.isFfmpegAvailable();
    if (!ffmpegAvailable)
      throw new Error("FFmpeg is not installed for local mode");

    const tempOggPath = path.join(__dirname, `temp_voice_${msgId}_local.ogg`);
    const tempWavPath = path.join(__dirname, `temp_voice_${msgId}_local.wav`);

    try {
      await fs.writeFile(tempOggPath, audioBuffer);
      const conversionStart = Date.now();
      await this.convertToWav(tempOggPath, tempWavPath);
      const conversionTime = Date.now() - conversionStart;
      // Use custom model dir if specified
      const whisperOptions = {
        modelName: this.modelSize,
        whisperOptions: { language: "auto" },
        ...(this.modelDir && { modelDir: this.modelDir }), // Pass modelDir to whisper-node
      };
      const transcript = await whisper(tempWavPath, whisperOptions);
      const text = transcript
        .map((item: { speech: string }) => item.speech)
        .join(" ")
        .trim();
      return { text, conversionTime };
    } finally {
      try {
        if (await fs.access(tempOggPath).catch(() => false))
          await fs.unlink(tempOggPath);
        if (await fs.access(tempWavPath).catch(() => false))
          await fs.unlink(tempWavPath);
      } catch (e) {
        console.warn("Local cleanup failed:", e);
      }
    }
  }

  /**
   * Main transcription method: dispatches to appropriate mode
   * @param audioBuffer - The OGG audio buffer
   * @param msgId - Message ID for unique file naming in local mode
   * @returns Promise<{ text: string; conversionTime?: number }> - Transcribed text and optional conversion time
   */
  public async transcribe(
    audioBuffer: Buffer,
    msgId: number
  ): Promise<{ text: string; conversionTime?: number }> {
    switch (this.mode) {
      case "local":
        return await this.transcribeLocal(audioBuffer, msgId);
      case "api":
        const textApi = await this.withRetry(() =>
          this.transcribeWhisperAPI(audioBuffer)
        );
        return { text: textApi };
      case "deepgram":
        const textDeepgram = await this.withRetry(() =>
          this.transcribeDeepgram(audioBuffer)
        );
        return { text: textDeepgram };
      default:
        throw new Error(`Unknown mode: ${this.mode}`);
    }
  }

  /**
   * Gets the current mode for logging
   * @returns string - Current transcription mode
   */
  public getMode(): string {
    return this.mode;
  }
}

/**
 * Class for managing Telegram userbot client and event handling
 * Integrates with VoiceTranscriber for processing private voice messages
 */
class TelegramUserbot {
  private readonly client: TelegramClient;
  private readonly transcriber: VoiceTranscriber;

  constructor(transcriber: VoiceTranscriber) {
    this.transcriber = transcriber;
    this.client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });
  }

  /**
   * Starts the client and sets up event handler
   * @returns Promise<void>
   */
  public async start(): Promise<void> {
    await this.client.start({
      phoneNumber: async () => input.text("Number?"),
      password: async () => input.text("Password?"),
      phoneCode: async () => input.text("Code?"),
      onError: (err) => console.log(err),
    });

    console.log(
      `Connected in ${this.transcriber.getMode()} mode. Parsing only private voice messages...`
    );

    this.client.addEventHandler(
      this.handleVoiceMessage.bind(this),
      new NewMessage({})
    );
  }

  /**
   * Event handler for new messages: processes only private voice messages
   * @param event - The new message event
   */
  private async handleVoiceMessage(event: {
    message: any;
    isPrivate: any;
  }): Promise<void> {
    const { message } = event;

    // Filter: only private voice messages
    if (!event.isPrivate || !message.voice) {
      return;
    }

    const sender = await message.getSender();
    const msgId = message.id;
    let downloadTime = 0,
      transcriptionTime = 0,
      conversionTime: number | undefined;
    const tempOggPath = path.join(__dirname, `temp_voice_${msgId}.ogg`);

    try {
      console.time("Total time");

      // Download voice message as Buffer
      const downloadStart = Date.now();
      const fileBuffer = await this.client.downloadMedia(message);

      if (!fileBuffer) {
        throw new Error("Failed to download media");
      }

      downloadTime = Date.now() - downloadStart;
      await fs.writeFile(tempOggPath, fileBuffer);
      console.log(`Private voice message downloaded to ${tempOggPath}`);

      // Read buffer for transcription
      const audioBuffer = await fs.readFile(tempOggPath);

      // Transcribe using the transcriber instance (pass msgId for local mode)
      const transcriptionStart = Date.now();
      const { text, conversionTime: convTime } =
        await this.transcriber.transcribe(audioBuffer, msgId);
      conversionTime = convTime;
      transcriptionTime = Date.now() - transcriptionStart;

      console.timeEnd("Total time");

      // Send responses to sender
      if (text) {
        await this.client.sendMessage(sender, { message: text });
      } else {
        await this.client.sendMessage(sender, {
          message: "Transcription failed or empty.",
        });
      }

      // Timings (include conversion if applicable)
      const timings =
        `Times: Download - ${downloadTime}ms` +
        (conversionTime ? `, Conversion - ${conversionTime}ms` : "") +
        `, Transcription - ${transcriptionTime}ms`;
      console.log(timings);
      await this.client.sendMessage(sender, { message: timings });
    } catch (error) {
      console.error("Error processing private voice message:", error);
      await this.client.sendMessage(sender, {
        message:
          "Sorry, an error occurred while processing your voice message.",
      });
    } finally {
      // Cleanup temporary file
      try {
        if (await fs.access(tempOggPath).catch(() => false)) {
          await fs.unlink(tempOggPath);
        }
      } catch (cleanupError) {
        console.warn("Cleanup failed:", cleanupError);
      }
    }
  }

  /**
   * Destroys the client (for graceful shutdown)
   * @returns Promise<void>
   */
  public async destroy(): Promise<void> {
    await this.client.destroy();
  }
}

(async () => {
  console.log(
    `Starting Telegram userbot in ${
      process.env.WHISPER_MODE || "api"
    } mode (model: ${process.env.WHISPER_MODEL_SIZE || "base"})...`,
    apiId,
    apiHash
  );

  // Initialize classes
  const transcriber = new VoiceTranscriber();
  const userbot = new TelegramUserbot(transcriber);

  await userbot.start();

  // Keep the client running
  console.log("Userbot is running. Press Ctrl+C to stop.");
  process.on("SIGINT", async () => {
    await userbot.destroy();
    process.exit(0);
  });
})();
