/*const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const input = require("input");
import env from "dotenv";
env.config();

//const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
//const OpenAI = require("openai");
var shell = require("shelljs");
const { whisper } = require("whisper-node");
const apiId = parseInt(process.env.TG_API_ID as string, 10);
const apiHash = process.env.TG_API_HASH as string;
const stringSession = new StringSession(process.env.TG_SESSION as string);
(async () => {
  console.log("Starting Telegram client...", apiId, apiHash);
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () => input.text("Number?"),
    password: async () => input.text("Password?"),
    phoneCode: async () => input.text("Code?"),
    onError: console.log,
  });

  console.log("Connected.");

  client.addEventHandler(async (event: { message: any; isPrivate: any }) => {
    const message = event.message;
    if (event.isPrivate && message.voice) {
      const sender = await message.getSender();
      const msgId = message.id;
      let downloadTime, conversionTime, transcriptionTime;
      try {
        console.time("Total time");

        const downloadStart = Date.now();
        const fileResult = await client.downloadMedia(message, { workers: 1 });
        downloadTime = Date.now() - downloadStart;

        const filePath = path.join(__dirname, `temp_voice_${msgId}.ogg`);
        await fs.writeFileSync(filePath, fileResult);
        console.log("Voice message saved to", filePath);

        const conversionStart = Date.now();
        const wavPath = path.join(__dirname, `output_voice_${msgId}.wav`);
        await shell.exec(`ffmpeg -i ${filePath} -ar 16000 ${wavPath}`);
        conversionTime = Date.now() - conversionStart;

        const transcriptionStart = Date.now();
        const transcript = await whisper(wavPath, {
          modelName: process.env.WHISPER_MODEL || "base",
          whisperOptions: {
            language: "auto",
          },
        });
        transcriptionTime = Date.now() - transcriptionStart;

        fs.unlinkSync(wavPath); // Clean up the temporary file
        fs.unlinkSync(filePath); // Clean up the temporary original file

        const transcriptText = transcript
          .map((item: { speech: string }) => item.speech)
          .join(" ");
        console.log(transcriptText);

        if (transcriptText) {
          await client.sendMessage(sender, { message: transcriptText });
        } else {
          await client.sendMessage(sender, {
            message: "Transcription failed or empty.",
          });
        }

        console.timeEnd("Total time");
        const finishTimeString = `Times: Download - ${downloadTime}ms, Conversion - ${conversionTime}ms, Transcription - ${transcriptionTime}ms`;
        console.log(finishTimeString);
        await client.sendMessage(sender, { message: finishTimeString });
      } catch (error) {
        console.error("Error processing voice message:", error);
        await client.sendMessage(sender, {
          message:
            "Sorry, an error occurred while processing your voice message.",
        });
      }
    }
  }, new NewMessage({}));
})();
*/
