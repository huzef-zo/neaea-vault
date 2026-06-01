/* ============================================
   NEAEA Vault — app.js
   Vanilla JS SPA: routing, exam engine, scoring
   ============================================ */

(function () {
  'use strict';

  // ─── Subject Registry ───
  const SUBJECTS = [
    { id: 'biology',   name: 'Biology',               icon: '🧬', papers: ['2015_p1'] },
    { id: 'chemistry', name: 'Chemistry',              icon: '⚗️', papers: ['2015_p1'] },
    { id: 'mathematics', name: 'Mathematics',          icon: '📐', papers: ['2015_p1'] },
    { id: 'physics',   name: 'Physics',                icon: '⚡', papers: ['2015_p1'] },
    { id: 'english',   name: 'English',                icon: '📖', papers: ['2015_p1'] },
    { id: 'aptitude',  name: 'Scholastic Aptitude',    icon: '🧠', papers: ['2015_p1'] },
  ];

  // ─── State ───
  let currentSubject = null;
  let currentPaperId = null;
  let currentPaperData = null;
  let currentQuestionIndex = 0;
  let userAnswers = [];
  let timerEnabled = false;
  let timerInterval = null;
  let timeRemaining = 0;
  let deferredInstallPrompt = null;

  // ─── DOM Cache ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    home:     $('#screen-home'),
    subjects: $('#screen-subjects'),
    papers:   $('#screen-papers'),
    exam:     $('#screen-exam'),
    results:  $('#screen-results'),
    review:   $('#screen-review'),
  };

  // ─── Navigation ───
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo(0, 0);
  }

  // Back button handlers
  document.querySelectorAll('.btn-back').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.go;
      if (target === 'home') showScreen('home');
      else if (target === 'subjects') showScreen('subjects');
      else if (target === 'papers') {
        stopTimer();
        showScreen('papers');
      }
      else if (target === 'results') showScreen('results');
    });
  });

  // Exit exam back button — confirm
  const exitExamBtn = document.querySelector('.btn-exit-exam');
  if (exitExamBtn) {
    exitExamBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (userAnswers.some((a) => a !== null)) {
        if (!confirm('Quit exam? Your progress will be lost.')) return;
      }
      stopTimer();
      showScreen('papers');
    });
  }

  // ─── Home & Subject Screens ───
  function renderSubjectGrid(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    SUBJECTS.forEach((sub) => {
      const paperCount = sub.papers.length;
      const card = document.createElement('div');
      card.className = 'subject-card';
      card.innerHTML = `
        <span class="subject-icon">${sub.icon}</span>
        <div class="subject-name">${sub.name}</div>
        <div class="subject-count">${paperCount} paper${paperCount !== 1 ? 's' : ''}</div>
      `;
      card.addEventListener('click', () => openSubject(sub.id));
      container.appendChild(card);
    });
  }

  function openSubject(subjectId) {
    currentSubject = SUBJECTS.find((s) => s.id === subjectId);
    if (!currentSubject) return;
    renderPapers();
    showScreen('papers');
  }

  // ─── Paper Select ───
  function renderPapers() {
    const list = document.getElementById('paper-list');
    const title = document.getElementById('papers-title');
    list.innerHTML = '';
    title.textContent = currentSubject.name;

    currentSubject.papers.forEach((paperId) => {
      const stats = getPaperStats(currentSubject.id, paperId);
      const card = document.createElement('div');
      card.className = 'paper-card';

      // Parse year and paper from ID like "2015_p1"
      const parts = paperId.split('_p');
      const year = parts[0] + ' E.C';
      const paperNum = parts[1] ? `Paper ${parts[1]}` : 'Paper 1';

      const bestClass = stats.best !== null ? 'has-best' : 'no-best';
      const bestText = stats.best !== null
        ? `Best: ${stats.best.score} / ${stats.best.total} (${Math.round((stats.best.score / stats.best.total) * 100)}%)`
        : 'Not attempted';

      card.innerHTML = `
        <div class="paper-year">${parts[0]}</div>
        <div class="paper-details">
          <div class="paper-title">${year} &middot; ${paperNum}</div>
          <div class="paper-meta">
            <span>${stats.questionCount} questions</span>
            <span>${stats.attempts} attempt${stats.attempts !== 1 ? 's' : ''}</span>
          </div>
          <div class="paper-best ${bestClass}">${bestText}</div>
        </div>
        <div class="paper-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `;
      card.addEventListener('click', () => startExam(currentSubject.id, paperId));
      list.appendChild(card);
    });
  }

  // ─── Score Tracking (localStorage) ───
  function getStorageKey(subjectId, paperId) {
    return `vault_${subjectId}_${paperId}`;
  }

  function getPaperStats(subjectId, paperId) {
    const key = getStorageKey(subjectId, paperId);
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    const questionCount = getQuestionCount(subjectId, paperId);

    if (!data || !data.attempts || data.attempts.length === 0) {
      return { best: null, attempts: 0, questionCount };
    }

    const bestAttempt = data.attempts.reduce((a, b) =>
      (a.score / a.total) > (b.score / b.total) ? a : b
    );

    return {
      best: bestAttempt,
      attempts: data.attempts.length,
      questionCount,
    };
  }

  function saveAttempt(subjectId, paperId, score, total) {
    const key = getStorageKey(subjectId, paperId);
    const data = JSON.parse(localStorage.getItem(key) || '{"attempts":[]}');

    const attempt = {
      date: new Date().toISOString().split('T')[0],
      score,
      total,
    };

    data.attempts.push(attempt);
    // Keep last 10
    if (data.attempts.length > 10) {
      data.attempts = data.attempts.slice(-10);
    }

    // Update best
    const bestScore = data.attempts.reduce((a, b) =>
      (a.score / a.total) > (b.score / b.total) ? a : b
    );
    data.best = bestScore.score;

    localStorage.setItem(key, JSON.stringify(data));
  }

  function getQuestionCount(subjectId, paperId) {
    // We'll use the cached data or a default
    if (currentPaperData && currentSubject && currentSubject.id === subjectId && currentPaperId === paperId) {
      return currentPaperData.questions.length;
    }
    // Fallback: try to read from localStorage stats
    const key = getStorageKey(subjectId, paperId);
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    if (data && data.attempts && data.attempts.length > 0) {
      return data.attempts[data.attempts.length - 1].total;
    }
    return 0;
  }

  // ─── Exam Engine ───
  async function startExam(subjectId, paperId) {
    currentPaperId = paperId;
    currentQuestionIndex = 0;
    userAnswers = [];

    try {
      const response = await fetch(`data/${subjectId}/${paperId}.json`);
      if (!response.ok) throw new Error('Failed to load paper');
      currentPaperData = await response.json();
    } catch (err) {
      showToast('Could not load paper. Check your connection.');
      console.error(err);
      return;
    }

    userAnswers = new Array(currentPaperData.questions.length).fill(null);

    // Update header
    $('#exam-subject-label').textContent = currentPaperData.subject;
    $('#exam-paper-label').textContent = `${currentPaperData.year} — Paper ${currentPaperData.paper}`;

    // Reset timer
    timerEnabled = false;
    $('#timer-toggle-btn').classList.remove('active');
    $('#timer-display').classList.add('hidden');

    showScreen('exam');
    renderQuestion();
  }

  function renderQuestion() {
    const q = currentPaperData.questions[currentQuestionIndex];
    const total = currentPaperData.questions.length;

    // Progress
    const pct = ((currentQuestionIndex + 1) / total) * 100;
    $('#progress-bar').style.width = pct + '%';
    $('#progress-text').textContent = `${currentQuestionIndex + 1} / ${total}`;

    // Question
    $('#question-number').textContent = `Question ${currentQuestionIndex + 1}`;
    $('#question-text').textContent = q.question;

    // Image
    const img = $('#question-image');
    if (q.image) {
      img.src = q.image;
      img.classList.remove('hidden');
    } else {
      img.classList.add('hidden');
      img.src = '';
    }

    // Options
    const grid = $('#options-grid');
    grid.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, i) => {
      const card = document.createElement('div');
      card.className = 'option-card';
      card.dataset.index = i;
      card.innerHTML = `
        <span class="option-letter">${letters[i]}</span>
        <span class="option-text">${opt}</span>
      `;
      card.addEventListener('click', () => handleAnswer(i));
      grid.appendChild(card);
    });

    // Hide explanation & next
    $('#explanation-box').classList.add('hidden');
    $('#btn-next').classList.add('hidden');

    // Start question timer if enabled
    if (timerEnabled) {
      startQuestionTimer();
    }
  }

  function handleAnswer(selectedIndex) {
    const q = currentPaperData.questions[currentQuestionIndex];
    const correctLetter = q.answer;
    const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctLetter);
    const isCorrect = selectedIndex === correctIndex;

    // Store answer
    userAnswers[currentQuestionIndex] = {
      selected: selectedIndex,
      correct: correctIndex,
      isCorrect,
    };

    // Stop timer
    stopTimer();

    // Visual feedback
    const options = $$('#options-grid .option-card');
    options.forEach((card, i) => {
      card.classList.add('disabled');
      if (i === correctIndex) card.classList.add('correct');
      if (i === selectedIndex && !isCorrect) card.classList.add('wrong');
    });

    // Show explanation
    if (q.explanation) {
      $('#explanation-text').textContent = q.explanation;
      $('#explanation-box').classList.remove('hidden');
    }

    // Show next button
    const nextBtn = $('#btn-next');
    const isLast = currentQuestionIndex >= currentPaperData.questions.length - 1;
    nextBtn.textContent = isLast ? 'See Results' : 'Next Question';
    nextBtn.classList.remove('hidden');
  }

  // Next question handler
  $('#btn-next').addEventListener('click', () => {
    const isLast = currentQuestionIndex >= currentPaperData.questions.length - 1;
    if (isLast) {
      finishExam();
    } else {
      currentQuestionIndex++;
      renderQuestion();
    }
  });

  // ─── Timer ───
  function startQuestionTimer() {
    stopTimer();
    const secondsPerQuestion = 90; // 1.5 minutes
    timeRemaining = secondsPerQuestion;
    updateTimerDisplay();

    const display = $('#timer-display');
    display.classList.remove('hidden', 'warning', 'danger');

    timerInterval = setInterval(() => {
      timeRemaining--;
      updateTimerDisplay();

      if (timeRemaining <= 10) {
        display.classList.add('danger');
      } else if (timeRemaining <= 30) {
        display.classList.add('warning');
      }

      if (timeRemaining <= 0) {
        stopTimer();
        // Auto-select nothing (skip) and move on
        if (userAnswers[currentQuestionIndex] === null) {
          // Mark as timed out
          const q = currentPaperData.questions[currentQuestionIndex];
          const correctIndex = ['A', 'B', 'C', 'D'].indexOf(q.answer);
          userAnswers[currentQuestionIndex] = {
            selected: -1,
            correct: correctIndex,
            isCorrect: false,
          };

          // Show correct answer
          const options = $$('#options-grid .option-card');
          options.forEach((card, i) => {
            card.classList.add('disabled');
            if (i === correctIndex) card.classList.add('correct');
          });

          if (q.explanation) {
            $('#explanation-text').textContent = q.explanation;
            $('#explanation-box').classList.remove('hidden');
          }

          const nextBtn = $('#btn-next');
          const isLast = currentQuestionIndex >= currentPaperData.questions.length - 1;
          nextBtn.textContent = isLast ? 'See Results' : 'Next Question';
          nextBtn.classList.remove('hidden');

          showToast('Time\'s up!');
        }
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    const m = Math.floor(timeRemaining / 60);
    const s = timeRemaining % 60;
    $('#timer-display').textContent =
      String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // Timer toggle
  $('#timer-toggle-btn').addEventListener('click', () => {
    timerEnabled = !timerEnabled;
    const btn = $('#timer-toggle-btn');
    const display = $('#timer-display');

    if (timerEnabled) {
      btn.classList.add('active');
      display.classList.remove('hidden');
      startQuestionTimer();
    } else {
      btn.classList.remove('active');
      display.classList.add('hidden');
      display.classList.remove('warning', 'danger');
      stopTimer();
    }
  });

  // ─── Finish Exam ───
  function finishExam() {
    stopTimer();

    const total = currentPaperData.questions.length;
    const score = userAnswers.filter((a) => a && a.isCorrect).length;
    const percentage = Math.round((score / total) * 100);
    const passed = percentage >= 50;

    // Save attempt
    saveAttempt(currentSubject.id, currentPaperId, score, total);

    // Render results
    const statusEl = $('#results-pass-fail');
    statusEl.textContent = passed ? 'PASSED' : 'FAILED';
    statusEl.className = 'results-status ' + (passed ? 'pass' : 'fail');

    $('#results-score-num').textContent = score;
    $('#results-score-total').textContent = total;
    $('#results-percentage').textContent = percentage + '%';

    // Best comparison
    const stats = getPaperStats(currentSubject.id, currentPaperId);
    const bestEl = $('#results-best');
    if (stats.best) {
      const bestPct = Math.round((stats.best.score / stats.best.total) * 100);
      if (score >= stats.best.score && score > 0) {
        bestEl.textContent = 'New Personal Best!';
        bestEl.className = 'results-best new-best';
      } else {
        bestEl.textContent = `Personal Best: ${stats.best.score}/${stats.best.total} (${bestPct}%)`;
        bestEl.className = 'results-best';
      }
    } else {
      bestEl.textContent = '';
      bestEl.className = 'results-best';
    }

    // Glow
    const glow = $('.results-glow');
    glow.className = 'results-glow ' + (passed ? 'pass-glow' : 'fail-glow');

    showScreen('results');
  }

  // Results buttons
  $('#btn-review').addEventListener('click', () => {
    renderReview();
    showScreen('review');
  });

  $('#btn-retry').addEventListener('click', () => {
    startExam(currentSubject.id, currentPaperId);
  });

  $('#btn-change-subject').addEventListener('click', () => {
    showScreen('subjects');
  });

  // ─── Review Mode ───
  function renderReview() {
    const list = $('#review-list');
    const summary = $('#review-summary');
    list.innerHTML = '';

    const total = currentPaperData.questions.length;
    const correct = userAnswers.filter((a) => a && a.isCorrect).length;
    summary.textContent = `You got ${correct} out of ${total} correct (${Math.round((correct / total) * 100)}%)`;

    const letters = ['A', 'B', 'C', 'D'];

    currentPaperData.questions.forEach((q, i) => {
      const answer = userAnswers[i];
      const isCorrect = answer && answer.isCorrect;
      const wasSkipped = !answer || answer.selected === -1;

      const item = document.createElement('div');
      item.className = 'review-item ' + (isCorrect ? 'review-correct' : 'review-wrong');

      let answersHtml = '';
      if (isCorrect) {
        answersHtml = `<div class="review-answers"><span class="review-correct-answer">Your answer: ${letters[answer.selected]} — Correct</span></div>`;
      } else if (wasSkipped) {
        answersHtml = `<div class="review-answers"><span class="review-your-answer">Skipped</span> &middot; <span class="review-correct-answer">Correct: ${letters[answer.correct]}</span></div>`;
      } else {
        answersHtml = `<div class="review-answers"><span class="review-your-answer">Your answer: ${letters[answer.selected]}</span> &middot; <span class="review-correct-answer">Correct: ${letters[answer.correct]}</span></div>`;
      }

      let imageHtml = '';
      if (q.image) {
        imageHtml = `<img class="review-q-image" src="${q.image}" alt="Question diagram" />`;
      }

      let explanationHtml = '';
      if (!isCorrect && q.explanation) {
        explanationHtml = `<div class="review-explanation">${q.explanation}</div>`;
      }

      item.innerHTML = `
        <div class="review-q-header">
          <span class="review-q-number">Question ${i + 1}</span>
          <span class="review-q-status ${isCorrect ? 'correct' : 'wrong'}">${isCorrect ? 'Correct' : 'Wrong'}</span>
        </div>
        <p class="review-q-text">${q.question}</p>
        ${imageHtml}
        ${answersHtml}
        ${explanationHtml}
      `;

      list.appendChild(item);
    });
  }

  // ─── Toast ───
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('visible');

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
  }

  // ─── Offline Status ───
  function updateOnlineStatus() {
    const indicator = $('#offline-indicator');
    if (!navigator.onLine) {
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // ─── PWA Install ───
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    // Show install prompt if not dismissed before
    const dismissed = localStorage.getItem('vault_install_dismissed');
    if (!dismissed) {
      document.getElementById('install-prompt').classList.remove('hidden');
    }
  });

  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === 'accepted') {
      showToast('App installed successfully!');
    }
    deferredInstallPrompt = null;
    document.getElementById('install-prompt').classList.add('hidden');
  });

  document.getElementById('install-dismiss').addEventListener('click', () => {
    document.getElementById('install-prompt').classList.add('hidden');
    localStorage.setItem('vault_install_dismissed', '1');
  });

  // ─── Service Worker Registration ───
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then((reg) => {
          console.log('SW registered:', reg.scope);
        })
        .catch((err) => {
          console.log('SW registration failed:', err);
        });
    });
  }

  // ─── Init ───
  function init() {
    renderSubjectGrid('home-subject-grid');
    renderSubjectGrid('subject-grid');
    updateOnlineStatus();
  }

  init();
})();
