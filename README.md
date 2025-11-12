# Telegram Whisper Multi Userbot

[![Node.js](https://img.shields.io/badge/Node.js-22-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Telegram userbot built with GramJS for automatic transcription of private voice messages. It processes only private voice messages, downloads OGG files, transcribes them to text using configurable modes (local Whisper, WhisperAPI.com, or Deepgram), and sends back to the sender: the transcript text, "Voice is converted.", and timings (download + transcription time, plus conversion for local mode).

This is a full userbot (runs from your personal account, not a bot), with OOP architecture for extensibility, concurrency-safe temp files (unique by message ID), and Docker support for easy deployment on VPS/hosting.

## Key Features

- **Multi-Transcription Modes**: Switch between offline/local, cloud APIs with no conversion needed for OGG.
  | Mode | Description | Requirements | Pros | Cons |
  |----------|--------------------------------------|-------------------------------|-------------------------------|----------------------------|
  | **local** | Local Whisper.cpp (GGML models via whisper-node) | FFmpeg, pre-downloaded model | Offline, free, private | CPU/RAM heavy (~500MB for base) |
  | **api** | WhisperAPI.com (native OGG support) | API key | Fast, easy, auto-language | Pay-per-use after free tier |
  | **deepgram** | Deepgram Nova-2 (native OGG) | API key | Ultra-fast, accurate | Free 200 min/month limit |

- **Retry Logic**: 3 attempts with exponential backoff for API failures (e.g., 5xx errors).
- **Concurrency Safe**: Temp files named `temp_voice_${msgId}_*.ogg/wav` to avoid conflicts from multiple users.
- **Timings**: Logs total time; sends detailed breakdown (download, conversion, transcription).
- **OOP Design**: `VoiceTranscriber` class handles modes; `TelegramUserbot` manages GramJS events.
- **Docker Optimized**: Multi-stage build, persistent models volume, auto-restart.
- **TypeScript**: Full types, including custom .d.ts for whisper-node and input.

## Architecture Overview

- **Event Handler**: Listens for `NewMessage` events, filters private voice only.
- **Download**: GramJS `client.downloadMedia()` → Buffer → Temp OGG file.
- **Transcription**:
  - Local: FFmpeg convert to WAV → whisper-node with custom modelDir.
  - API: FormData/Buffer POST to endpoint with retry.
- **Response**: Send transcript → "Voice is converted." → Timings to sender.
- **Cleanup**: Async unlink temp files in finally block.

Extend by adding modes in `VoiceTranscriber.transcribe()` or handlers in `TelegramUserbot.handleVoiceMessage()`.

## Quick Start (Local)

1. Clone the repo:

   ```
   git clone https://github.com/LeXuS-Azazello/telegram-whisper-multi.git
   cd telegram-whisper-multi
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Get Telegram API credentials from [my.telegram.org](https://my.telegram.org) (API ID & Hash).

4. Copy and configure `.env` (see below).

5. For local mode, download model:

   ```
   mkdir models
   npx whisper-node download --model base --model_dir ./models
   ```

6. Run in dev mode:
   ```
   npm run dev
   ```
   - First run: Enter phone number, password, code — session saves to TG_SESSION.
   - Test: Send a voice message in private chat → Receive transcript + "Voice is converted." + timings.

Production: `npm start`.

## Configuration (.env)

Create `.env` from `.env_EXAMPLE` and fill:

```
# Telegram (from my.telegram.org)
TG_API_ID=your_api_id_here
TG_API_HASH=your_api_hash_here
TG_SESSION=your_session_string_here  # Auto-generated on first login

# Transcription (defaults: local mode)
WHISPER_MODE=local  # local, api, deepgram
WHISPER_MODEL_SIZE=base  # base, small, medium, large-v2
WHISPER_MODEL_DIR=./models  # Local; /app/models in Docker

# API Modes
WHISPER_API_KEY=your_whisper_api_key_here  # From whisper-api.com
DEEPGRAM_KEY=your_deepgram_key_here  # From deepgram.com

# Optional
DEV_MODE=true  # Send timings to user (false for prod)
```

## Docker Deployment

Ideal for VPS/hosting (e.g., DigitalOcean, AWS Lightsail).

1. Prepare directories:

   ```
   mkdir -p models logs
   ```

2. Build image (specify mode/model via .env or args):

   ```
   docker-compose build --no-cache --build-arg WHISPER_MODE=local --build-arg MODEL_SIZE=base
   ```

   - Downloads model to `./models` if local (GGML .bin file, ~150MB for base).
   - Uses node:22-slim for GNU wget compatibility in script.

3. Run in background:

   ```
   docker-compose up -d
   ```

4. Monitor:

   - Status: `docker-compose ps`
   - Logs: `docker-compose logs -f userbot` (look for "Connected in local mode..." and auth prompts).
   - Stats: `docker stats` (monitor CPU/RAM).

5. Stop/update:
   ```
   docker-compose down
   git pull && docker-compose up -d --build
   ```

**Notes**: Models persist in `./models` (volume). No ports exposed (userbot polls Telegram). Restart policy: always.

## Usage Example

- User sends voice in private chat.
- Userbot logs: "Private voice message downloaded to temp_voice_123.ogg" + "Total time: 4500ms".
- Replies:
  1. "Hello, this is the transcribed text from your voice."
  2. "Voice is converted."
  3. "Times: Download - 500ms, Conversion - 200ms, Transcription - 3800ms" (conversion only for local).

## Troubleshooting

- **Build Fails (TS18003 No inputs)**: Ensure `COPY src ./src` before `npm run build` in Dockerfile.
- **Whisper Init/Make Failed**: Check runtime deps (wget/curl, make/g++). Use `--no-cache` on build.
- **Model Not Found**: Verify WHISPER_MODEL_DIR path; redownload with `npx whisper-node download`.
- **API Errors**: Invalid key? Check .env. Retry handles transient issues.
- **Concurrency Conflicts**: Files use msgId — safe for multiple users.
- **Docker Size**: Slim base ~300MB; prune with `docker system prune -f`.
- **Session Expires**: Rerun auth; save TG_SESSION manually.

For issues: Open a GitHub issue with logs.

## Contributing

- Fork, PR with tests.
- Run: `npm test` (add if needed).
- Extend: New mode? Add case in `transcribe()`; new message type? Update `handleVoiceMessage()`.

## Dependencies

- **Core**: GramJS (MTProto), TypeScript, dotenv.
- **Local**: whisper-node (Whisper.cpp), FFmpeg.
- **API**: node-fetch, form-data.
- **Dev**: ts-node, @types/node.

## License

GNU License — free to use/modify. Main author: LeXuS-Azazello.
