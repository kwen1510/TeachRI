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

const port = process.env.PORT || 3000;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.warn('Warning: OPENAI_API_KEY is not set. API routes will fail until it is provided.');
}

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const SAMPLE_TRANSCRIPTION = {
  text: 'Sample transcription generated locally.',
  segments: [
    {
      id: 1,
      start: '00:00',
      end: '00:45',
      speaker: 'Teacher',
      text: 'Good morning everyone! Today we are exploring ecosystems and how they change over time.'
    },
    {
      id: 2,
      start: '00:45',
      end: '01:12',
      speaker: 'Student A',
      text: 'An ecosystem is the relationship between living things and the environment around them.'
    },
    {
      id: 3,
      start: '01:12',
      end: '02:04',
      speaker: 'Teacher',
      text: 'Turn and talk with a partner about ways our class can protect the pollinator garden this spring.'
    }
  ]
};

const SAMPLE_FEEDBACK = `Lesson strengths\n- Students engaged in collaborative dialogue and used academic vocabulary to describe ecosystems.\n- The lesson objective was revisited throughout the discussion which kept learners focused.\n\nSuggestions\n- Include a quick formative check (thumbs up/down or digital poll) to capture every student voice.\n- Provide a sentence stem or graphic organizer to support learners who need structure in partner discussions.\n\nNext steps\n1. Capture student ideas on an anchor chart to revisit next class.\n2. Ask students to connect their discussion to a real-world action they can take this week.`;

function ensureUploadsDir() {
  const uploadsPath = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
}

ensureUploadsDir();

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads') });

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.json({
      transcription: SAMPLE_TRANSCRIPTION,
      note: 'No audio uploaded. Returned sample transcription so you can test the UI.'
    });
  }

  try {
    if (!openaiApiKey || !openai) {
      fs.unlink(req.file.path, () => {});
      return res.json({ transcription: SAMPLE_TRANSCRIPTION, note: 'Returned sample transcription because no API key was configured.' });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'gpt-4o-mini-transcribe'
    });

    fs.unlink(req.file.path, () => {});

    return res.json({ transcription });
  } catch (error) {
    console.error('Transcription error:', error);
    fs.unlink(req.file.path, () => {});
    if (!openaiApiKey || !openai) {
      return res.json({ transcription: SAMPLE_TRANSCRIPTION, note: 'Returned sample transcription because the OpenAI request could not be completed.' });
    }
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
    if (!openaiApiKey || !openai) {
      return res.json({
        feedback: SAMPLE_FEEDBACK,
        note: 'Returned sample feedback because no API key was configured.'
      });
    }

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
    if (!openaiApiKey || !openai) {
      return res.json({
        feedback: SAMPLE_FEEDBACK,
        note: 'Returned sample feedback because the OpenAI request could not be completed.'
      });
    }
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
