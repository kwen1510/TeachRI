import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads') });

const port = process.env.PORT || 3000;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.warn('Warning: OPENAI_API_KEY is not set. API routes will fail until it is provided.');
}

const openai = new OpenAI({ apiKey: openaiApiKey });

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded.' });
  }

  if (!openaiApiKey) {
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: 'OpenAI API key not configured on the server.' });
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'gpt-4o-mini-transcribe'
    });

    fs.unlink(req.file.path, () => {});

    return res.json({ transcription });
  } catch (error) {
    console.error('Transcription error:', error);
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({
      error: 'Failed to transcribe audio with OpenAI.',
      details: error?.response?.data || error.message
    });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { transcriptionJson, researchText, lessonPlan } = req.body || {};

  if (!transcriptionJson || !researchText || !lessonPlan) {
    return res.status(400).json({
      error: 'transcriptionJson, researchText, and lessonPlan are required fields.'
    });
  }

  if (!openaiApiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured on the server.' });
  }

  let parsedTranscript;
  let transcriptSummary = '';

  try {
    parsedTranscript = JSON.parse(transcriptionJson);
  } catch (parseError) {
    console.warn('Could not parse transcription JSON, sending raw string.');
  }

  if (Array.isArray(parsedTranscript)) {
    transcriptSummary = parsedTranscript
      .map((entry, index) => {
        const timestamp = entry?.timestamp ?? entry?.start ?? `segment-${index + 1}`;
        const speaker = entry?.speaker ? `${entry.speaker}: ` : '';
        const text = entry?.text || JSON.stringify(entry);
        return `(${timestamp}) ${speaker}${text}`;
      })
      .join('\n');
  } else if (typeof parsedTranscript === 'object' && parsedTranscript !== null) {
    transcriptSummary = JSON.stringify(parsedTranscript, null, 2);
  } else {
    transcriptSummary = transcriptionJson;
  }

  const prompt = `You are a supportive instructional coach helping teachers reflect on their practice.\n` +
    `Use the provided lesson plan, any research references, and the classroom transcript to create:\n` +
    `1. A warm summary of the lesson strengths.\n` +
    `2. Specific, actionable suggestions for improvement aligned to the teacher's plan.\n` +
    `3. Connections to the referenced research when relevant.\n` +
    `4. A short set of next steps for the teacher.\n` +
    `Keep the tone encouraging, specific, and professional.`;

  try {
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Lesson Plan:\n' + lessonPlan },
            { type: 'text', text: '\nResearch References:\n' + researchText },
            { type: 'text', text: '\nClassroom Transcript Summary:\n' + transcriptSummary }
          ]
        }
      ]
    });

    return res.json({
      feedback: response.output_text || 'No response text was returned from the model.'
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: 'Failed to generate feedback with OpenAI.',
      details: error?.response?.data || error.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.listen(port, () => {
  console.log(`TeachRI server running on http://localhost:${port}`);
});
