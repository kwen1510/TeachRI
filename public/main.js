const transcriptionForm = document.getElementById('transcription-form');
const transcriptionResult = document.getElementById('transcription-result');
const analysisForm = document.getElementById('analysis-form');
const feedbackSection = document.getElementById('feedback');
const feedbackContent = document.getElementById('feedback-content');

function setButtonState(button, loading, defaultLabel) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? 'Working…' : defaultLabel;
}

async function handleTranscription(event) {
  event.preventDefault();
  const submitButton = transcriptionForm.querySelector('button[type="submit"]');
  const audioInput = document.getElementById('audio');

  if (!audioInput.files?.length) {
    transcriptionResult.textContent = 'Please choose an audio file before submitting.';
    transcriptionResult.classList.remove('hidden');
    return;
  }

  const formData = new FormData();
  formData.append('audio', audioInput.files[0]);

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

    transcriptionResult.textContent = JSON.stringify(payload.transcription, null, 2);
    transcriptionResult.classList.remove('hidden');
    document.getElementById('transcriptionJson').value = JSON.stringify(payload.transcription, null, 2);
  } catch (error) {
    transcriptionResult.textContent = error.message;
    transcriptionResult.classList.remove('hidden');
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

    const formatted = (data.feedback || '').split('\n').map((paragraph) => paragraph.trim()).filter(Boolean);

    feedbackContent.innerHTML = formatted.map((paragraph) => `<p>${paragraph}</p>`).join('');
    feedbackSection.classList.remove('hidden');
  } catch (error) {
    feedbackContent.innerHTML = `<p>${error.message}</p>`;
    feedbackSection.classList.remove('hidden');
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
