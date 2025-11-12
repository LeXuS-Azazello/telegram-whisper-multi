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

MIT License — free to use/modify. Main author: LeXuS-Azazello.
