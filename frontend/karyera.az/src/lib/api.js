const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function analyzeCV(resumeText) {
  const res = await fetch(`${API_URL}/api/cv/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume_text: resumeText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function submitQuiz(quiz, userAnswers, gapAnalysis) {
  const res = await fetch(`${API_URL}/api/cv/submit-quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quiz, user_answers: userAnswers, gap_analysis: gapAnalysis }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchJobs() {
  const res = await fetch(`${API_URL}/api/jobs`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}