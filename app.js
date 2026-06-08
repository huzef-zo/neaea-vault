/* ============================================
   NEAEA Vault — app.js
   Vanilla JS SPA: routing, exam engine, scoring
   ============================================ */

(function () {
  'use strict';

  // ─── Subject Registry ───
  let SUBJECTS = [];

  const SUBJECT_META = {
    biology: { name: 'Biology', icon: '🧬' },
    chemistry: { name: 'Chemistry', icon: '⚗️' },
    mathematics: { name: 'Mathematics', icon: '📐' },
    physics: { name: 'Physics', icon: '⚡' },
    english: { name: 'English', icon: '📖' },
    aptitude: { name: 'Scholastic Aptitude', icon: '🧠' },
  };

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

  // Helper to resolve absolute image paths dynamically for subpath deployments
  function resolveImagePath(imagePath) {
    if (!imagePath || !currentSubject) return '';
    if (imagePath.startsWith('http')) return imagePath;

    // Remove leading ./ if present
    const cleanPath = imagePath.startsWith('./') ? imagePath.slice(2) : imagePath;

    // Get base URL (current directory of index.html)
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

    return `${baseUrl}data/${currentSubject.id}/${cleanPath}`;

  function renderMath(element) {
    if (typeof renderMathInElement === "function") {
      renderMathInElement(element, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
      });
    } else {
      console.error("KaTeX auto-render (renderMathInElement) not loaded");
    }
  }
  }

  const screens = {
    home:     $('#screen-home'),
    subjects: $('#screen-subjects'),
    papers:   $('#screen-papers'),
    exam:      $('#screen-exam'),
    results:   $('#screen-results'),
    review:    $('#screen-review'),
    analytics: $('#screen-analytics'),
  };

  // ─── Navigation ───
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo(0, 0);
  }

  // Navigation handlers
  $$('.btn-back').forEach((btn) => {
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

  const startPracticeBtn = $('#btn-start-practice');
  if (startPracticeBtn) {
    startPracticeBtn.addEventListener('click', () => showScreen('subjects'));
  }

  const showAnalyticsBtn = $('#btn-show-analytics');
  if (showAnalyticsBtn) {
    showAnalyticsBtn.addEventListener('click', () => {
      renderAnalytics();
      showScreen('analytics');
    });
  }

  // Exit exam back button — confirm
  const exitExamBtn = $('.btn-exit-exam');
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
    const container = $('#' + containerId);
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
    const list = $('#paper-list');
    const title = $('#papers-title');
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
      card.addEventListener('click', () => showTimerModal(currentSubject.id, paperId));
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

  // ─── Timer Modal Logic ───
  function showTimerModal(subjectId, paperId) {
    const modal = $('#timer-modal');
    const parts = paperId.split('_p');
    const year = parts[0] + ' E.C';
    const paperNum = parts[1] ? `Paper ${parts[1]}` : 'Paper 1';

    $('#modal-paper-title').textContent = `${year} · ${paperNum}`;
    modal.classList.remove('hidden');

    // Load preference
    const pref = localStorage.getItem('vault_timer_preference') || '90';
    updateModalTimer(parseInt(pref));

    // Event listeners for modal
    const startBtn = $('#btn-modal-start');
    const newStartBtn = startBtn.cloneNode(true);
    startBtn.parentNode.replaceChild(newStartBtn, startBtn);

    newStartBtn.addEventListener('click', () => {
      const h = parseInt($('#timer-hours').value) || 0;
      const m = parseInt($('#timer-minutes').value) || 0;
      const totalMinutes = (h * 60) + m;

      if (totalMinutes > 0) {
        timerEnabled = true;
        timeRemaining = totalMinutes * 60;
      } else {
        timerEnabled = false;
        timeRemaining = 0;
      }

      // Save preference if it was one of the presets or just save it
      localStorage.setItem('vault_timer_preference', totalMinutes.toString());

      modal.classList.add('hidden');
      startExam(subjectId, paperId);
    });

    // Preset buttons
    $$('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.dataset.time);
        updateModalTimer(mins);
      });
    });

    // Manual adjustment
    $$('.btn-timer-adj').forEach(btn => {
      btn.addEventListener('click', () => {
        const unit = btn.dataset.unit;
        const dir = btn.dataset.dir;
        const input = unit === 'h' ? $('#timer-hours') : $('#timer-minutes');
        let val = parseInt(input.value) || 0;

        if (dir === 'up') val++;
        else val--;

        if (unit === 'h') {
          if (val < 0) val = 0;
          if (val > 99) val = 99;
        } else {
          if (val < 0) val = 59;
          if (val > 59) val = 0;
        }

        input.value = String(val).padStart(2, '0');
        // Deactivate presets if manual adj
        $$('.preset-btn').forEach(b => b.classList.remove('active'));
      });
    });

    // Dismiss on outside click
    const overlay = $('.modal-overlay');
    overlay.onclick = () => modal.classList.add('hidden');
  }

  function updateModalTimer(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    $('#timer-hours').value = String(h).padStart(2, '0');
    $('#timer-minutes').value = String(m).padStart(2, '0');

    $$('.preset-btn').forEach(btn => {
      if (parseInt(btn.dataset.time) === totalMinutes) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // ─── Exam Engine ───
  async function startExam(subjectId, paperId) {
    currentPaperId = paperId;
    currentQuestionIndex = 0;
    userAnswers = [];

    const url = `data/${subjectId}/${paperId}.json`;

    let response;
    try {
      console.log(`Step 1: Fetching paper JSON from ${url}...`);
      response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    } catch (err) {
      console.error('Step 1 Failed: Fetching paper JSON failed', err);
      showToast(`Fetch error: ${err.message}`);
      return;
    }

    try {
      console.log('Step 2: Parsing JSON...');
      currentPaperData = await response.json();
    } catch (err) {
      console.error('Step 2 Failed: Parsing JSON failed', err);
      showToast(`Parse error: ${err.message}`);
      return;
    }

    try {
      console.log('Step 3: Rendering questions...');
      if (!currentPaperData.questions) throw new Error('Paper data is missing "questions" array');

      userAnswers = new Array(currentPaperData.questions.length).fill(null);

      // Update header
      $('#exam-subject-label').textContent = currentPaperData.subject;
      $('#exam-paper-label').textContent = `${currentPaperData.year} — Paper ${currentPaperData.paper}`;

      // Initial timer setup handled by modal, but ensure display is correct
      if (timerEnabled) {
        $('#timer-toggle-btn').classList.add('active');
        $('#timer-display').classList.remove('hidden');
        startGlobalTimer();
      } else {
        $('#timer-toggle-btn').classList.remove('active');
        $('#timer-display').classList.add('hidden');
      }

      showScreen('exam');
      renderQuestion();
    } catch (err) {
      console.error('Step 3 Failed: Rendering failed', err);
      showToast(`Render error: ${err.message}`);
      return;
    }
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
      img.src = resolveImagePath(q.image);
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
        <span class="option-text"></span>
      `;
      card.querySelector('.option-text').textContent = opt;
      card.addEventListener('click', () => handleAnswer(i));
      grid.appendChild(card);
    });

    // Render Math
    renderMath($('#question-area'));

    // Hide explanation & next
    $('#explanation-box').classList.add('hidden');
    $('#btn-next').classList.add('hidden');

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
      renderMath($('#explanation-box'));
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
  function startGlobalTimer() {
    stopTimer();
    updateTimerDisplay();
    updateTimerStatus();

    timerInterval = setInterval(() => {
      timeRemaining--;
      updateTimerDisplay();
      updateTimerStatus();

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
          renderMath($('#explanation-box'));

          showToast('Time\'s up!');
        }
      }
    }, 1000);
  }

  function updateTimerStatus() {
    const display = $('#timer-display');
    display.classList.remove('warning', 'danger');

    // Warning indicators: 10min (600s) and 5min (300s)
    if (timeRemaining <= 300) {
      display.classList.add('danger');
    } else if (timeRemaining <= 600) {
      display.classList.add('warning');
    }
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    const h = Math.floor(timeRemaining / 3600);
    const m = Math.floor((timeRemaining % 3600) / 60);
    const s = timeRemaining % 60;

    if (h > 0) {
      $('#timer-display').textContent =
        String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    } else {
      $('#timer-display').textContent =
        String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
  }

  // Timer toggle
  $('#timer-toggle-btn').addEventListener('click', () => {
    timerEnabled = !timerEnabled;
    const btn = $('#timer-toggle-btn');
    const display = $('#timer-display');

    if (timerEnabled) {
      btn.classList.add('active');
      display.classList.remove('hidden');
      if (timeRemaining <= 0) timeRemaining = 90 * 60; // Default if somehow toggled on without time
      startGlobalTimer();
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
        imageHtml = `<img class="review-q-image" src="${resolveImagePath(q.image)}" alt="Question diagram" />`;
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
        <p class="review-q-text"></p>
        ${imageHtml}
        ${answersHtml}
        ${explanationHtml}
      `;
      item.querySelector('.review-q-text').textContent = q.question;

      list.appendChild(item);
    });
    renderMath(list);
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
      $('#install-prompt').classList.remove('hidden');
    }
  });

  $('#install-btn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === 'accepted') {
      showToast('App installed successfully!');
    }
    deferredInstallPrompt = null;
    $('#install-prompt').classList.add('hidden');
  });

  $('#install-dismiss').addEventListener('click', () => {
    $('#install-prompt').classList.add('hidden');
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

  // ─── Performance Analytics ───
  function calculateAnalytics() {
    const stats = {};

    SUBJECTS.forEach(sub => {
      let totalScore = 0;
      let totalQuestions = 0;
      let attemptsCount = 0;
      let lastAttempts = [];

      sub.papers.forEach(paperId => {
        const key = getStorageKey(sub.id, paperId);
        const data = JSON.parse(localStorage.getItem(key) || 'null');

        if (data && data.attempts && data.attempts.length > 0) {
          data.attempts.forEach(attempt => {
            totalScore += attempt.score;
            totalQuestions += attempt.total;
            attemptsCount++;
          });
          // For trend, we need last 3 attempts across all papers of this subject
          // Or per paper? Requirement says "per subject comparing last 3 attempts"
          lastAttempts = lastAttempts.concat(data.attempts);
        }
      });

      if (attemptsCount > 0) {
        // Sort lastAttempts by date to get the actual last 3
        lastAttempts.sort((a, b) => new Date(a.date) - new Date(b.date));
        // Requirement: "comparing last 3 attempts". Let's show dots for last 3.

        stats[sub.id] = {
          name: sub.name,
          icon: sub.icon,
          avg: Math.round((totalScore / totalQuestions) * 100),
          attempts: attemptsCount,
          recent: lastAttempts.slice(-3)
        };
      }
    });

    return stats;
  }

  function renderAnalytics() {
    const container = $('#analytics-subject-list');
    if (!container) return;
    container.innerHTML = '';

    const stats = calculateAnalytics();
    const statEntries = Object.entries(stats);

    if (statEntries.length === 0) {
      container.innerHTML = '<div class="glass-card" style="text-align:center; padding: 40px; color: var(--text-secondary);">No exam data yet. Start practicing to see your performance!</div>';
      $('#best-subject-name').textContent = '--';
      $('#best-subject-score').textContent = '--';
      $('#worst-subject-name').textContent = '--';
      $('#worst-subject-score').textContent = '--';
      return;
    }

    // Sort by avg
    statEntries.sort((a, b) => b[1].avg - a[1].avg);

    const best = statEntries[0][1];
    const worst = statEntries[statEntries.length - 1][1];

    $('#best-subject-name').textContent = best.name;
    $('#best-subject-score').textContent = `${best.avg}% Avg`;
    $('#worst-subject-name').textContent = worst.name;
    $('#worst-subject-score').textContent = `${worst.avg}% Avg`;

    statEntries.forEach(([id, data]) => {
      const card = document.createElement('div');
      card.className = 'analytics-subject-card glass-card';

      const avgClass = data.avg >= 60 ? 'high' : (data.avg >= 40 ? 'mid' : 'low');

      // Trend logic: compare each of last 3 with the one before it
      let trendHtml = '';
      if (data.recent.length >= 2) {
        trendHtml = '<div class="trend-dots">';
        for (let i = 1; i < data.recent.length; i++) {
          const prev = data.recent[i-1].score / data.recent[i-1].total;
          const curr = data.recent[i].score / data.recent[i].total;
          let trend = 'stable';
          if (curr > prev) trend = 'up';
          if (curr < prev) trend = 'down';
          trendHtml += `<span class="trend-dot ${trend}"></span>`;
        }
        trendHtml += '</div><span class="trend-label">Trend</span>';
      }

      card.innerHTML = `
        <span class="analytics-subject-icon">${data.icon}</span>
        <div class="analytics-subject-info">
          <div class="analytics-subject-name">${data.name}</div>
          <div class="analytics-subject-avg ${avgClass}">${data.avg}% Average Score</div>
        </div>
        <div class="analytics-subject-trend">
          ${trendHtml}
        </div>
      `;
      container.appendChild(card);
    });
  }

  // ─── Init ───
  async function init() {
    try {
      const response = await fetch('data/manifest.json');
      if (!response.ok) throw new Error('Failed to load manifest');
      const manifest = await response.json();

      SUBJECTS = Object.entries(manifest).map(([id, papers]) => {
        const meta = SUBJECT_META[id] || { name: id.charAt(0).toUpperCase() + id.slice(1), icon: '📚' };
        return {
          id,
          name: meta.name,
          icon: meta.icon,
          papers,
        };
      });

      renderSubjectGrid('subject-grid');
    } catch (err) {
      console.error('Initialization error:', err);
      showToast('Error loading exam data. Please refresh.');
    }
    updateOnlineStatus();
  }

  init();
})();
