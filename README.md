# TeachRI Lesson Reflection Assistant

This project is a Node.js + Express prototype designed for deployment on Render. It helps teachers reflect on classroom practice by combining lesson plans, research notes, and classroom transcripts with OpenAI's APIs.

## Features

- Upload classroom audio to request speech-to-text transcription via OpenAI's `gpt-4o-mini-transcribe` model.
- Submit transcription JSON, research references, and lesson plan text to generate tailored coaching insights using the `gpt-4.1-mini` model.
- Simple responsive UI for quick testing and iteration.

## Prerequisites

- Node.js 18+
- An OpenAI API key with access to `gpt-4o-mini-transcribe` and `gpt-4.1-mini`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

   > If you are running in an environment without external network access, install packages locally before deployment.

2. Copy the example environment file and add your OpenAI API key:

   ```bash
   cp .env.example .env
   ```

   Update `.env`:

   ```dotenv
   OPENAI_API_KEY=sk-your-key
   PORT=3000 # optional override
   ```

3. Start the development server:

   ```bash
   npm run start
   ```

4. Open `http://localhost:3000` in your browser and submit the form to generate coaching feedback.

## Deployment on Render

1. Push this repository to your Git provider.
2. Create a new **Web Service** on Render targeting the repo.
3. Set the build command to `npm install` and the start command to `npm run start`.
4. Add the `OPENAI_API_KEY` environment variable in Render's dashboard.

## API Routes

- `POST /api/transcribe`: Accepts `multipart/form-data` with an `audio` file field. Returns JSON from OpenAI's speech-to-text API.
- `POST /api/analyze`: Accepts JSON with `transcriptionJson`, `researchText`, and `lessonPlan` fields. Returns generated coaching feedback.

## Notes

- Uploaded audio files are stored temporarily on disk and deleted after transcription completes.
- The UI includes placeholder text for quick testing when no audio is available.
- Remember to handle usage costs and guard against prompt injection when preparing for production.
