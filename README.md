# Telegram Whisper MultiApi

## Description

This is a Telegram multiapi that performs offline Whisper transcription of voice messages. It uses GramJS for MTProto to interact with Telegram and `whisper-node` for audio transcription.

## Features

- Converts Telegram voice messages to text.
- Uses `ffmpeg` to convert OGG files to WAV format suitable for transcription.
- Transcribes audio using the Whisper model.
- Sends transcribed text back to the user in Telegram.

## Installation

### Prerequisites

- Node.js v22 and npm installed
- ffmpeg installed and added to `PATH`
- A Telegram account
- A Telegram API ID and Hash

### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/LeXuS-Azazello/telegram-whisper-userbot
   cd telegram-whisper-userbot
   npm i
   npx whisper-node download
   ```

   Default model is `base`, but you can change it in `src/index.ts` by modifying the `modelName` property in the `WHISPER_OPTIONS` object.
