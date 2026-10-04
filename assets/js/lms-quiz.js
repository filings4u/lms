/* screenings4u Learning Center — Quiz Runtime */
(() => {
  "use strict";

  const BUILD = "20261004-training3";
  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";
  const STORAGE_KEY = "s4u-training-auth-session";

  console.info(`[LMS Quiz] build ${BUILD}`);

  let db;
  let user;
  let mode = "quiz";
  let attemptId = null;
  let attemptNumber = 0;
  let meta = {};
  let questions = [];
  let index = 0;
  let submittedReview = null;
  const answers = new Map();
  const params = new URLSearchParams(location.search);
  const enrollmentId = params.get("enrollment");
  const quizId = params.get("quiz");
  const assessmentId = params.get("assessment");
  const courseId = params.get("course");
  const lessonId = params.get("lesson");

  document.addEventListener("DOMContentLoaded", () => init().catch(fail));

  async function init() {
    if (!window.supabase?.createClient) throw new Error("Supabase is unavailable.");

    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.sessionStorage,
        storageKey: STORAGE_KEY
      }
    });

    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session?.user) {
      location.replace(`training-login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    user = sessionData.session.user;

    if (!enrollmentId) throw new Error("This assessment is missing its enrollment reference.");
    mode = assessmentId || params.get("type") === "final-assessment" ? "assessment" : "quiz";

    const exit = document.getElementById("coursePlayerLink");
    if (exit) exit.href = playerUrl();

    if (mode === "quiz" && quizId) {
      const prior = await db.rpc("lms_get_latest_completed_quiz_review", {
        p_quiz_id: quizId,
        p_enrollment_id: enrollmentId
      });
      if (prior.error) throw prior.error;
      if (prior.data?.attempt_id) {
        meta = prior.data.quiz || {};
        attemptNumber = Number(prior.data.attempt_number || 0);
        showCompletedSummary(prior.data);
        return;
      }
    }

    await startNewAttempt();
  }

  async function startNewAttempt() {
    submittedReview = null;
    answers.clear();
    index = 0;

    let response;
    if (mode === "assessment") {
      if (!assessmentId) throw new Error("This final assessment is missing its assessment reference.");
      response = await db.rpc("lms_start_assessment_attempt", {
        p_assessment_id: assessmentId,
        p_enrollment_id: enrollmentId
      });
    } else {
      if (!quizId) throw new Error("This knowledge check is missing its quiz reference.");
      response = await db.rpc("lms_start_quiz_attempt", {
        p_quiz_id: quizId,
        p_enrollment_id: enrollmentId
      });
    }

    if (response.error) throw response.error;
    const data = response.data || {};
    attemptId = data.attempt_id;
    attemptNumber = Number(data.attempt_number || 1);
    meta = data.assessment || data.quiz || {};
    questions = Array.isArray(data.questions) ? data.questions : [];

    if (!attemptId) throw new Error("The Learning Center could not create an assessment attempt.");
    if (!questions.length) throw new Error("This assessment does not have any published questions.");

    setup();
    renderQuestionNavigation();
    render();
  }

  function setup() {
    const finalAssessment = mode === "assessment";
    const title = meta.title || (finalAssessment ? "Final Assessment" : "Knowledge Check");
    const description = meta.description || (finalAssessment
      ? "Complete the final assessment to demonstrate your understanding of the course."
      : "Complete this knowledge check before continuing to the next lesson.");

    document.title = `${title} | screenings4u Learning Center`;
    setText("topbarTitle", finalAssessment ? "Final Assessment" : "Knowledge Check");
    setText("quizType", finalAssessment ? "FINAL COMPREHENSIVE ASSESSMENT" : "MODULE KNOWLEDGE CHECK");
    setText("quizTitle", title);
    setText("quizDescription", description);
    setText("sideTitle", title);
    setText("sideDescription", finalAssessment
      ? "This assessment covers knowledge from the complete training course."
      : "Your answers are graded securely when you submit this attempt.");
    setText("questionCount", questions.length);
    setText("passingScore", `${Number(meta.passing_score || 80)}%`);

    const limit = Number(finalAssessment ? meta.max_attempts : meta.attempt_limit);
    setText("attempts", limit ? `${attemptNumber} of ${limit}` : `${attemptNumber} · Unlimited`);
  }

  function renderQuestionNavigation() {
    const list = document.getElementById("questionList");
    if (!list) return;
    list.innerHTML = questions.map((_, i) => `<button type="button" class="question-dot" data-go="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`).join("");
    list.addEventListener("click", event => {
      const button = event.target.closest("[data-go]");
      if (!button) return;
      index = Number(button.dataset.go);
      render();
    });
  }

  function render() {
    const q = questions[index];
    const selected = answers.get(q.id) || null;
    const pct = Math.round(((index + 1) / questions.length) * 100);
    const options = Array.isArray(q.options) ? q.options : [];

    setText("progressLabel", `Question ${index + 1} of ${questions.length}`);
    setText("progressPercent", `${pct}%`);
    document.getElementById("quizFill").style.width = `${pct}%`;

    const panel = document.getElementById("questionPanel");
    panel.innerHTML = `
      <div class="question-number">Question ${index + 1}</div>
      <h2 class="quiz-question-title">${escapeHtml(q.question_text)}</h2>
      <div class="quiz-options">
        ${options.map((option, optionIndex) => `
          <button type="button" class="quiz-option ${selected === option.id ? "selected" : ""}" data-answer="${escapeHtml(option.id)}">
            <span class="option-letter">${String.fromCharCode(65 + optionIndex)}</span>
            <span class="option-copy">${escapeHtml(option.option_text)}</span>
          </button>`).join("")}
      </div>
      <div class="quiz-actions">
        <button type="button" class="quiz-btn quiz-btn-secondary" id="prevBtn" ${index === 0 ? "disabled" : ""}>Previous Question</button>
        <button type="button" class="quiz-btn quiz-btn-primary" id="nextBtn" ${selected ? "" : "disabled"}>${index === questions.length - 1 ? "Submit Answers" : "Next Question"}</button>
      </div>`;

    panel.querySelectorAll("[data-answer]").forEach(button => {
      button.addEventListener("click", () => {
        answers.set(q.id, button.dataset.answer);
        render();
      });
    });

    document.getElementById("prevBtn").addEventListener("click", () => {
      if (index > 0) {
        index -= 1;
        render();
      }
    });

    document.getElementById("nextBtn").addEventListener("click", () => {
      if (!answers.get(q.id)) return;
      if (index < questions.length - 1) {
        index += 1;
        render();
      } else {
        confirmSubmit();
      }
    });

    document.querySelectorAll(".question-dot").forEach((button, n) => {
      button.classList.toggle("current", n === index);
      button.classList.toggle("answered", answers.has(questions[n].id) && n !== index);
    });
  }

  function confirmSubmit() {
    const firstMissing = questions.findIndex(q => !answers.has(q.id));
    if (firstMissing >= 0) {
      index = firstMissing;
      render();
      showConfirm({
        title: "Questions Remaining",
        message: `Please answer all questions before submitting. ${questions.filter(q => !answers.has(q.id)).length} remaining.`,
        confirmText: "Continue",
        cancelText: null,
        onConfirm: () => {}
      });
      return;
    }

    showConfirm({
      title: "Submit Assessment",
      message: "Submit this attempt for grading? You will not be able to change these answers afterward.",
      confirmText: "Submit Answers",
      cancelText: "Review Answers",
      onConfirm: () => submit().catch(fail)
    });
  }

  function showConfirm({ title, message, confirmText, cancelText, onConfirm }) {
    const overlay = document.createElement("div");
    overlay.className = "quiz-confirm";
    overlay.innerHTML = `
      <div class="quiz-confirm-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        <div class="quiz-confirm-actions">
          ${cancelText ? `<button type="button" class="quiz-btn quiz-btn-secondary" data-cancel>${escapeHtml(cancelText)}</button>` : ""}
          <button type="button" class="quiz-btn quiz-btn-primary" data-confirm>${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", () => overlay.remove());
    overlay.querySelector("[data-confirm]").addEventListener("click", () => {
      overlay.remove();
      onConfirm?.();
    });
  }

  async function submit() {
    document.querySelectorAll("#questionPanel button").forEach(button => { button.disabled = true; });
    const payload = questions.map(q => ({
      question_id: q.id,
      selected_option_id: answers.get(q.id) || null,
      answer_text: null
    }));

    const response = mode === "assessment"
      ? await db.rpc("lms_submit_assessment_attempt", { p_attempt_id: attemptId, p_answers: payload })
      : await db.rpc("lms_v2_submit_quiz_attempt", { p_attempt_id: attemptId, p_answers: payload });

    if (response.error) throw response.error;

    if (mode === "quiz") {
      const review = await db.rpc("lms_get_quiz_attempt_review", { p_attempt_id: attemptId });
      if (review.error) throw review.error;
      submittedReview = review.data || null;
    }

    renderResult(response.data || {});
  }

  function renderResult(raw) {
    const source = submittedReview || raw || {};
    const score = Number(source.score || 0);
    const passed = source.passed === true;
    const required = Number(source.passing_score || meta.passing_score || 80);
    const reviewQuestions = Array.isArray(source.questions) ? source.questions : [];
    const correctCount = reviewQuestions.filter(item => item.is_correct === true).length;
    const totalCount = reviewQuestions.length || questions.length;

    document.getElementById("quizFill").style.width = "100%";
    setText("progressPercent", "100%");
    setText("progressLabel", passed ? "Assessment passed" : "Attempt completed");
    document.getElementById("questionNavigationCard").hidden = true;

    const panel = document.getElementById("questionPanel");
    panel.innerHTML = resultMarkup({ score, passed, required, reviewQuestions, correctCount, totalCount, previous: false });
    bindResultActions(passed);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showCompletedSummary(review) {
    const score = Number(review.score || 0);
    const passed = review.passed === true;
    const required = Number(review.passing_score || review.quiz?.passing_score || 80);
    const rows = Array.isArray(review.questions) ? review.questions : [];
    const correctCount = rows.filter(item => item.is_correct === true).length;
    const totalCount = rows.length || Number(review.question_count || 0);
    const title = review.quiz?.title || "Knowledge Check";

    document.title = `${title} | screenings4u Learning Center`;
    setText("topbarTitle", "Knowledge Check");
    setText("quizType", "MODULE KNOWLEDGE CHECK");
    setText("quizTitle", title);
    setText("quizDescription", passed ? "Your completed result is saved in the Learning Center." : "Your previous completed attempt is saved.");
    setText("sideTitle", title);
    setText("sideDescription", "Your most recent completed attempt is shown here.");
    setText("questionCount", totalCount || "—");
    setText("passingScore", `${required}%`);
    setText("attempts", `Completed attempt ${review.attempt_number || "—"}`);
    setText("progressLabel", "Completed attempt");
    setText("progressPercent", `${formatScore(score)}%`);
    document.getElementById("quizFill").style.width = `${Math.min(100, Math.max(0, score))}%`;
    document.getElementById("questionNavigationCard").hidden = true;

    document.getElementById("questionPanel").innerHTML = resultMarkup({
      score,
      passed,
      required,
      reviewQuestions: rows,
      correctCount,
      totalCount,
      previous: true,
      attempt: review.attempt_number
    });
    bindResultActions(passed);
  }

  function resultMarkup({ score, passed, required, reviewQuestions, correctCount, totalCount, previous, attempt }) {
    const summary = `
      <div class="quiz-result-summary">
        <div><strong>${formatScore(score)}%</strong><span>Score</span></div>
        <div><strong>${correctCount}/${totalCount || "—"}</strong><span>Correct</span></div>
        <div><strong>${required}%</strong><span>Required</span></div>
        <div><strong>${escapeHtml(attempt || attemptNumber || "—")}</strong><span>Attempt</span></div>
      </div>`;

    const review = reviewQuestions.length ? `
      <section class="quiz-review">
        <div class="quiz-review-head">
          <div><span class="quiz-review-eyebrow">ANSWER REVIEW</span><h3>${previous ? "Completed Attempt Review" : "Review Your Answers"}</h3></div>
          <span class="quiz-review-count">${correctCount} of ${totalCount} correct</span>
        </div>
        ${reviewQuestions.map((item, i) => reviewCard(item, i)).join("")}
      </section>` : "";

    return `
      <div class="result-panel">
        <div class="result-icon ${passed ? "is-success" : "is-retry"}">${passed ? checkIcon() : retryIcon()}</div>
        <div class="quiz-result-status ${passed ? "passed" : "not-passed"}">${passed ? "PASSED" : "REVIEW REQUIRED"}</div>
        <h2>${passed ? "Assessment Completed" : "Attempt Completed"}</h2>
        <div class="result-score">${formatScore(score)}%</div>
        <p>${passed
          ? "Your passing score has been saved. Return to the course to continue your training."
          : `The required score is ${required}%. Review your answers before starting another attempt.`}</p>
        ${summary}
        ${review}
        <div class="quiz-actions quiz-result-actions">
          ${passed
            ? `<a class="quiz-btn quiz-btn-primary" href="${playerUrl()}">Return to Course</a>`
            : `<button type="button" class="quiz-btn quiz-btn-primary" id="takeQuizAgainBtn">Take Quiz Again</button><a class="quiz-btn quiz-btn-secondary" href="${playerUrl()}">Return to Course</a>`}
        </div>
      </div>`;
  }

  function bindResultActions(passed) {
    if (passed) return;
    document.getElementById("takeQuizAgainBtn")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Starting Attempt...";
      try {
        document.getElementById("questionNavigationCard").hidden = false;
        await startNewAttempt();
      } catch (error) {
        button.disabled = false;
        button.textContent = "Take Quiz Again";
        fail(error);
      }
    });
  }

  function reviewCard(item, i) {
    const correct = item.is_correct === true;
    return `
      <article class="quiz-review-card ${correct ? "correct" : "incorrect"}">
        <div class="quiz-review-question">
          <span class="quiz-review-number">${i + 1}</span>
          <div>
            <span class="quiz-review-badge">${correct ? "✓ Correct" : "✕ Incorrect"}</span>
            <h4>${escapeHtml(item.question_text || "Question")}</h4>
          </div>
        </div>
        <div class="quiz-review-answer"><span>Your answer</span><strong>${escapeHtml(item.selected_answer || "No answer")}</strong></div>
        ${!correct && item.correct_answer ? `<div class="quiz-review-answer correct-answer"><span>Correct answer</span><strong>${escapeHtml(item.correct_answer)}</strong></div>` : ""}
        ${item.explanation ? `<div class="quiz-review-explanation"><strong>Explanation</strong><p>${escapeHtml(item.explanation)}</p></div>` : ""}
      </article>`;
  }

  function playerUrl() {
    const query = new URLSearchParams();
    if (courseId) query.set("course", courseId);
    if (enrollmentId) query.set("enrollment", enrollmentId);
    if (lessonId) query.set("lesson", lessonId);
    return `lms-course-player.html${query.toString() ? `?${query}` : ""}`;
  }

  function fail(error) {
    console.error("[LMS Quiz]", error);
    const panel = document.getElementById("questionPanel");
    if (panel) {
      panel.innerHTML = `<div class="quiz-error"><h2>Assessment Unavailable</h2><p>${escapeHtml(error?.message || "Unable to load this assessment.")}</p><div class="quiz-actions quiz-result-actions"><a class="quiz-btn quiz-btn-secondary" href="${playerUrl()}">Return to Course</a></div></div>`;
    }
    document.getElementById("questionNavigationCard")?.setAttribute("hidden", "");
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function formatScore(value) {
    const score = Number(value || 0);
    return score.toFixed(score % 1 ? 2 : 0);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function checkIcon() {
    return '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>';
  }

  function retryIcon() {
    return '<svg viewBox="0 0 24 24"><path d="M20 6v5h-5"></path><path d="M19 11a7 7 0 1 0 1 5"></path></svg>';
  }
})();
