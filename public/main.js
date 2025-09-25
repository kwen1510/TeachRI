const transcriptionForm = document.getElementById('transcription-form');
const transcriptionResult = document.getElementById('transcription-result');
const transcriptionNote = document.getElementById('transcription-note');
const loadSampleButton = document.getElementById('load-sample');
const analysisForm = document.getElementById('analysis-form');
const feedbackSection = document.getElementById('feedback');
const feedbackContent = document.getElementById('feedback-content');
const feedbackNote = document.getElementById('feedback-note');

const SAMPLE_SEGMENTS = [
  {
    timestamp: '00:00-00:45',
    speaker: 'Teacher',
    text: "Good morning everyone! Today we're exploring ecosystems."
  },
  {
    timestamp: '00:45-01:30',
    speaker: 'Student A',
    text: 'An ecosystem is where living and non-living things interact.'
  },
  {
    timestamp: '01:30-02:15',
    speaker: 'Teacher',
    text: 'Exactly. Turn to your partner and discuss how humans impact local ecosystems.'
  }
];

const SAMPLE_TRANSCRIPTION = {
  text: 'Sample transcription generated locally.',
  segments: SAMPLE_SEGMENTS
};

const SAMPLE_RESEARCH = 'Focus on inquiry-based learning to support student agency and embed formative feedback checkpoints (Black & Wiliam, 2018).';

const SAMPLE_LESSON_PLAN = 'Lesson Objective: Students will describe how human actions can support or disrupt the balance of local ecosystems.\nPlanned Activities: Warm-up question, mini-lesson, partner discussion, exit ticket reflection.';

const SAMPLE_FEEDBACK = `Lesson strengths\n- Students engaged in collaborative dialogue and used academic vocabulary to describe ecosystems.\n- The lesson objective was revisited throughout the discussion which kept learners focused.\n\nSuggestions\n- Include a quick formative check (thumbs up/down or digital poll) to capture every student voice.\n- Provide a sentence stem or graphic organizer to support learners who need structure in partner discussions.\n\nNext steps\n1. Capture student ideas on an anchor chart to revisit next class.\n2. Ask students to connect their discussion to a real-world action they can take this week.`;

function showNote(element, message) {
  if (!element) return;
  if (message) {
    element.textContent = message;
    element.classList.remove('hidden');
  } else {
    element.textContent = '';
    element.classList.add('hidden');
  }
}

function renderTranscription(transcription, note) {
  if (!transcriptionResult) return;
  const serialised = typeof transcription === 'string'
    ? transcription
    : JSON.stringify(transcription, null, 2);
  transcriptionResult.textContent = serialised;
  transcriptionResult.classList.remove('hidden');
  showNote(transcriptionNote, note);
}

function populateSampleForm() {
  if (!analysisForm) return;
  analysisForm.transcriptionJson.value = JSON.stringify(SAMPLE_SEGMENTS, null, 2);
  analysisForm.researchText.value = SAMPLE_RESEARCH;
  analysisForm.lessonPlan.value = SAMPLE_LESSON_PLAN;
}

function renderFeedback(feedback, note) {
  if (!feedbackSection || !feedbackContent) return;
  const formatted = (feedback || '')
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  feedbackContent.innerHTML = formatted.map((paragraph) => `<p>${paragraph}</p>`).join('');
  feedbackSection.classList.remove('hidden');
  showNote(feedbackNote, note);
}

function setButtonState(button, loading, defaultLabel) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? 'Working…' : defaultLabel;
}

async function handleTranscription(event) {
  event.preventDefault();
  const submitButton = transcriptionForm.querySelector('button[type="submit"]');
  const audioInput = document.getElementById('audio');

  const formData = new FormData();
  if (audioInput.files?.length) {
    formData.append('audio', audioInput.files[0]);
  }

  setButtonState(submitButton, true, 'Transcribe Audio');
  transcriptionResult.classList.add('hidden');

  try {
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Unable to transcribe audio.');
    }

    renderTranscription(payload.transcription, payload.note);
    const serialisedSegments = payload.transcription?.segments || payload.transcription;
    analysisForm.transcriptionJson.value = JSON.stringify(serialisedSegments, null, 2);
  } catch (error) {
    renderTranscription(error.message, 'There was an issue transcribing audio. Showing the error message below.');
  } finally {
    setButtonState(submitButton, false, 'Transcribe Audio');
  }
}

async function handleAnalysis(event) {
  event.preventDefault();
  const submitButton = analysisForm.querySelector('button[type="submit"]');
  setButtonState(submitButton, true, 'Generate Coaching Feedback');
  feedbackSection.classList.add('hidden');
  feedbackContent.innerHTML = '';
  showNote(feedbackNote, '');

  const payload = {
    transcriptionJson: analysisForm.transcriptionJson.value.trim(),
    researchText: analysisForm.researchText.value.trim(),
    lessonPlan: analysisForm.lessonPlan.value.trim()
  };

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate coaching insights.');
    }

    renderFeedback(data.feedback, data.note);
  } catch (error) {
    renderFeedback(error.message, 'There was an issue generating insights. Showing the error message below.');
  } finally {
    setButtonState(submitButton, false, 'Generate Coaching Feedback');
  }
}

if (transcriptionForm) {
  transcriptionForm.addEventListener('submit', handleTranscription);
}

if (analysisForm) {
  analysisForm.addEventListener('submit', handleAnalysis);
}

if (loadSampleButton) {
  loadSampleButton.addEventListener('click', () => {
    renderTranscription(SAMPLE_TRANSCRIPTION, 'Sample transcription loaded.');
    populateSampleForm();
    renderFeedback(SAMPLE_FEEDBACK, 'Sample feedback loaded. Submit the form to request fresh insights.');
  });
}

populateSampleForm();
renderTranscription(SAMPLE_TRANSCRIPTION, 'Sample transcription ready to preview. Upload audio to replace it.');
renderFeedback(SAMPLE_FEEDBACK, 'Sample feedback ready to preview. Submit the form to request fresh insights.');
