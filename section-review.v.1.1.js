(function () {
  var ACTIVE_ATTEMPT_FUNCTION_URL =
    "https://eaxashxpqpihonnuhdpx.supabase.co/functions/v1/get-active-attempt";
  var ACTIVE_TEST_CONTENT_FUNCTION_URL =
    "https://eaxashxpqpihonnuhdpx.supabase.co/functions/v1/get-active-test-content";
  var SAVE_SURVEY_FUNCTION_URL =
    "https://eaxashxpqpihonnuhdpx.supabase.co/functions/v1/save-test-survey";
  var ACTIVE_TEST_URL = "https://www.premedcatalyst.com/active-test";
  var POST_TEST_SURVEY_URL = "https://www.premedcatalyst.com/post-test-survey";
  var SCORE_REPORT_URL = "https://www.premedcatalyst.com/score-report";
  var SECTION_REVIEW_URL = "https://www.premedcatalyst.com/section-review";
  var ALLOWED_SECTION_POSITION_STORAGE_PREFIX =
    "portal_allowed_section_position:";
  var TIMER_STORAGE_KEY = "portal_timer_state";
  var ATTEMPT_ANSWERS_STORAGE_KEY = "portal_attempt_answers";
  var ATTEMPT_ANSWER_EVENTS_STORAGE_KEY = "portal_attempt_answer_events";
  var QUESTION_DWELL_STORAGE_KEY = "portal_attempt_question_dwell";
  var PASSAGE_ANNOTATIONS_STORAGE_KEY = "portal_passage_annotations";
  var SECTION_REVIEW_CONTEXT_KEY = "portal_section_review_context";
  var PASSAGE_SUBMIT_DRAFT_KEY = "portal_passage_submit_draft";
  var SECTION_PASSAGE_SURVEY_STORAGE_KEY =
    "portal_section_passage_survey_ratings";
  var SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheGFzaHhwcXBpaG9ubnVoZHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDk4MzMsImV4cCI6MjA4ODAyNTgzM30.j8n-puyJ6rKDMibSCxteJeWbVpI7xkxFux_njkHXlGg";
  var FIRST_PASSAGE_BREAK_SECONDS = 10 * 60;
  var LATER_PASSAGE_BREAK_SECONDS = 30 * 60;
  var BREAK_INTERVAL_ID = null;
  var BREAK_DONE_STORAGE_PREFIX = "portal_passage_break_done:";
  var CURRENT_FILTER = "all";
  var CURRENT_SUMMARY = null;
  var CURRENT_CONTENT = null;
  var ROW_LIST_LAYOUT = {
    container: null,
    template: null,
  };
  var TAB_STYLE_SNAPSHOT = null;
  var FILTER_TAB_LABELS = null;
  var ROW_STATUS_STYLE_SNAPSHOT = null;
  var INCOMPLETE_STATUS_CLASS = "incompletet";
  var PRELOAD_STYLE_ID = "section-review-preload-style";
  var PASSAGE_SURVEY_METRICS = [
    "difficulty",
    "topic_familiarity",
    "mind_wandering",
    "confidence",
    "interest",
    "anxiety",
  ];

  (function hidePageBeforeInit() {
    if (document.getElementById(PRELOAD_STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = PRELOAD_STYLE_ID;
    style.textContent =
      "body > *:not(#section-review-loader){display:none !important;}";
    (document.head || document.documentElement).appendChild(style);
  })();

  function showPageLoader() {
    if (document.querySelector("#section-review-loader")) return;
    var loader = document.createElement("div");
    loader.id = "section-review-loader";
    loader.style.position = "fixed";
    loader.style.inset = "0";
    loader.style.background = "rgba(255,255,255,0.9)";
    loader.style.backdropFilter = "blur(1px)";
    loader.style.zIndex = "99999";
    loader.style.display = "flex";
    loader.style.alignItems = "center";
    loader.style.justifyContent = "center";
    loader.innerHTML =
      '<div style="font-family:Arial,sans-serif;color:#000;font-weight:700;font-size:16px;">Loading section review...</div>';
    document.body.appendChild(loader);
  }

  function hidePageLoader() {
    var loader = document.querySelector("#section-review-loader");
    if (loader) loader.remove();
    var preloadStyle = document.getElementById(PRELOAD_STYLE_ID);
    if (preloadStyle) preloadStyle.remove();
  }

  function getPortalUser() {
    var raw = localStorage.getItem("portal_user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function getPortalUserId() {
    var direct = localStorage.getItem("portal_user_id");
    if (direct) return direct;
    var user = getPortalUser();
    return user && user.id ? user.id : null;
  }

  function getInitialsFromUser(user) {
    if (!user) return "??";
    var first = (user.first_name || "").trim();
    var last = (user.last_name || "").trim();
    if (first && last) {
      return (first[0] + last[0]).toUpperCase();
    }
    var fullName = (user.name || "").trim();
    if (!fullName) return "??";
    var parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  function getFullNameFromUser(user) {
    if (!user) return "";
    var first = (user.first_name || "").trim();
    var last = (user.last_name || "").trim();
    if (first || last) return (first + " " + last).trim();
    return (user.name || "").trim();
  }

  function applyPortalUserToHeader() {
    var user = getPortalUser();
    var fullName = getFullNameFromUser(user);
    var initials = getInitialsFromUser(user);
    setText("[data-user-full-name]", fullName);
    setText("[full-name]", fullName);
    setText("[data-user-initials]", initials);
  }

  function getPassageAttemptId() {
    return (
      new URLSearchParams(window.location.search || "").get(
        "passage_attempt_id",
      ) || localStorage.getItem("portal_active_passage_attempt_id")
    );
  }

  function getAttemptId() {
    return (
      new URLSearchParams(window.location.search || "").get("attempt_id") ||
      localStorage.getItem("portal_active_attempt_id")
    );
  }

  function getContentSessionId(content) {
    if (!content) return null;
    if (content.session_kind === "passage" && content.passage_attempt_id) {
      return content.passage_attempt_id;
    }
    return content.attempt_id || null;
  }

  function isPassageSession(content) {
    return Boolean(content && content.session_kind === "passage");
  }

  function withSessionPayload(base, content) {
    var payload = Object.assign({}, base || {});
    if (window.PortalSession && window.PortalSession.withSessionPayload) {
      return window.PortalSession.withSessionPayload(payload);
    }
    if (isPassageSession(content) && content.passage_attempt_id) {
      payload.passage_attempt_id = content.passage_attempt_id;
      delete payload.attempt_id;
      return payload;
    }
    var attemptId = getAttemptId();
    if (attemptId) payload.attempt_id = attemptId;
    delete payload.passage_attempt_id;
    return payload;
  }

  function getPassageId() {
    return new URLSearchParams(window.location.search || "").get("passage_id");
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (node) {
      node.textContent = String(value == null ? "" : value);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function postToFunction(url, body) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    }).then(async function (res) {
      var data = await res.json();
      if (!res.ok) throw new Error((data && data.error) || "Request failed");
      return data;
    });
  }

  function formatDuration(seconds) {
    var s = Math.max(0, Number(seconds || 0));
    var hh = String(Math.floor(s / 3600)).padStart(2, "0");
    var mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    var ss = String(s % 60).padStart(2, "0");
    return hh + ":" + mm + ":" + ss;
  }

  function loadTimerSnapshot() {
    var raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function saveTimerSnapshot(snapshot) {
    if (!snapshot) return;
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(snapshot));
  }

  function pauseExamTimer(attemptId, remainingSeconds) {
    var snapshot = loadTimerSnapshot() || {};
    snapshot.attempt_id = attemptId;
    snapshot.remaining_seconds = Math.max(0, Number(remainingSeconds || 0));
    snapshot.exam_paused = true;
    snapshot.pause_context = "section_review";
    snapshot.updated_at = new Date().toISOString();
    saveTimerSnapshot(snapshot);
    setText("[data-time-remaining]", formatDuration(snapshot.remaining_seconds));
    setText("[time-remaining]", formatDuration(snapshot.remaining_seconds));
  }

  function resumeExamTimer(attemptId, remainingSeconds) {
    var snapshot = loadTimerSnapshot() || {};
    snapshot.attempt_id = attemptId;
    snapshot.remaining_seconds = Math.max(0, Number(remainingSeconds || 0));
    snapshot.exam_paused = false;
    delete snapshot.pause_context;
    snapshot.updated_at = new Date().toISOString();
    saveTimerSnapshot(snapshot);
    setText("[data-time-remaining]", formatDuration(snapshot.remaining_seconds));
    setText("[time-remaining]", formatDuration(snapshot.remaining_seconds));
  }

  function breakDoneStorageKey(attemptId, passageId) {
    return BREAK_DONE_STORAGE_PREFIX + attemptId + ":" + passageId;
  }

  function hasPassageBreakCompleted(attemptId, passageId) {
    if (!attemptId || !passageId) return false;
    return (
      sessionStorage.getItem(breakDoneStorageKey(attemptId, passageId)) === "1"
    );
  }

  function markPassageBreakCompleted(attemptId, passageId) {
    if (!attemptId || !passageId) return;
    sessionStorage.setItem(breakDoneStorageKey(attemptId, passageId), "1");
  }

  function getBreakSecondsForPassage(position) {
    return Number(position) === 1
      ? FIRST_PASSAGE_BREAK_SECONDS
      : LATER_PASSAGE_BREAK_SECONDS;
  }

  function setBreakTimeHeader(seconds) {
    var label = "--:--:--";
    if (seconds != null && Number.isFinite(Number(seconds))) {
      label = formatDuration(Math.max(0, Number(seconds)));
    }
    setText("[data-break-time]", label);
    setText("[data-break-remaining]", label);
    setText("[break-time]", label);
  }

  function stopBreakCountdown() {
    if (BREAK_INTERVAL_ID) {
      clearInterval(BREAK_INTERVAL_ID);
      BREAK_INTERVAL_ID = null;
    }
  }

  function getAllowedSectionPosition(attemptId) {
    if (!attemptId) return 1;
    var raw = localStorage.getItem(
      ALLOWED_SECTION_POSITION_STORAGE_PREFIX + attemptId,
    );
    var parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  function setAllowedSectionPosition(attemptId, position) {
    if (!attemptId || !position) return;
    localStorage.setItem(
      ALLOWED_SECTION_POSITION_STORAGE_PREFIX + attemptId,
      String(position),
    );
  }

  function getAttemptAnswerMap() {
    var raw = localStorage.getItem(ATTEMPT_ANSWERS_STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (_) {
      return {};
    }
  }

  function syncAttemptAnswersFromContent(content) {
    var contentSessionId = getContentSessionId(content);
    if (!content || !contentSessionId || !Array.isArray(content.navigation_items)) {
      return;
    }

    var map = getAttemptAnswerMap();
    var changed = false;

    content.navigation_items.forEach(function (item) {
      if (!item || !item.question_id || !item.selected_choice) return;
      map[item.question_id] = {
        attempt_id: contentSessionId,
        selected_choice: item.selected_choice,
        selected_at: new Date().toISOString(),
      };
      changed = true;
    });

    if (changed) {
      localStorage.setItem(ATTEMPT_ANSWERS_STORAGE_KEY, JSON.stringify(map));
    }
  }

  function mergeLocalAttemptAnswersIntoContent(content) {
    if (!content || !getContentSessionId(content)) return content;

    var map = getAttemptAnswerMap();
    function resolveChoice(questionId, existingChoice) {
      var local = map[questionId];
      if (
        local &&
        local.attempt_id === getContentSessionId(content) &&
        local.selected_choice
      ) {
        return local.selected_choice;
      }
      return existingChoice || null;
    }

    if (Array.isArray(content.navigation_items)) {
      content.navigation_items.forEach(function (item) {
        if (!item || !item.question_id) return;
        item.selected_choice = resolveChoice(
          item.question_id,
          item.selected_choice,
        );
      });
    }

    if (content.current_question && content.current_question.id) {
      content.current_question.selected_choice = resolveChoice(
        content.current_question.id,
        content.current_question.selected_choice,
      );
    }

    return content;
  }

  function countAnsweredQuestions(content) {
    if (!content || !Array.isArray(content.navigation_items)) return 0;
    return content.navigation_items.filter(function (item) {
      return Boolean(item && item.selected_choice);
    }).length;
  }

  function getPassageSummaries(content) {
    if (!content || !Array.isArray(content.navigation_items)) return [];
    var summaries = [];
    var seen = {};
    content.navigation_items.forEach(function (item) {
      if (!item || !item.passage_id || seen[item.passage_id]) return;
      seen[item.passage_id] = true;
      var passageItems = content.navigation_items.filter(function (row) {
        return row.passage_id === item.passage_id;
      });
      if (passageItems.length === 0) return;
      var numbers = passageItems.map(function (row) {
        return Number(row.global_question_number || 0);
      });
      summaries.push({
        passage_id: item.passage_id,
        passage_title: item.passage_title || "Passage",
        passage_section: item.passage_section || null,
        position: summaries.length + 1,
        question_start: Math.min.apply(null, numbers),
        question_end: Math.max.apply(null, numbers),
        items: passageItems.slice().sort(function (a, b) {
          return (
            Number(a.global_question_number || 0) -
            Number(b.global_question_number || 0)
          );
        }),
      });
    });
    return summaries;
  }

  function hasSelectedAnswer(item) {
    return Boolean(item && item.selected_choice);
  }

  function getQuestionStatus(item) {
    return hasSelectedAnswer(item) ? "complete" : "incomplete";
  }

  function getStatusLabel(status) {
    return status === "complete" ? "Complete" : "Incomplete";
  }

  function getFilterCounts(items) {
    var counts = { all: items.length, incomplete: 0, unseen: 0, flagged: 0 };
    items.forEach(function (item) {
      if (!hasSelectedAnswer(item)) counts.incomplete += 1;
      if (item.is_flagged) counts.flagged += 1;
    });
    return counts;
  }

  function getFilteredItems(items, filter) {
    if (filter === "incomplete") {
      return items.filter(function (item) {
        return !hasSelectedAnswer(item);
      });
    }
    if (filter === "unseen") {
      return items.filter(function (item) {
        return !hasSelectedAnswer(item);
      });
    }
    if (filter === "flagged") {
      return items.filter(function (item) {
        return Boolean(item.is_flagged);
      });
    }
    return items;
  }

  function getQuestionDwellSecondsForAttempt(attemptId) {
    if (!attemptId) return {};
    var raw = localStorage.getItem(QUESTION_DWELL_STORAGE_KEY);
    if (!raw) return {};
    try {
      var root = JSON.parse(raw) || {};
      var byQ = root[attemptId] || {};
      var out = {};
      Object.keys(byQ).forEach(function (qid) {
        var n = Math.max(0, Math.floor(Number(byQ[qid]) || 0));
        if (n > 0) out[qid] = n;
      });
      return out;
    } catch (_) {
      return {};
    }
  }

  function navigateToActiveTestFromSectionReview(
    sessionId,
    passageId,
    questionNumber,
    options,
    isPassage,
  ) {
    stopBreakCountdown();
    hideBreakPanel();
    var remaining =
      (loadTimerSnapshot() && loadTimerSnapshot().remaining_seconds) ||
      Number((CURRENT_CONTENT && CURRENT_CONTENT.remaining_seconds) || 0);
    resumeExamTimer(sessionId, remaining);
    window.location.href = buildActiveTestUrl(
      sessionId,
      passageId,
      questionNumber,
      options,
      isPassage,
    );
  }

  function buildActiveTestUrl(sessionId, passageId, questionNumber, options, isPassage) {
    var reviewAll = options && options.reviewAll;
    var sessionQuery = isPassage
      ? "passage_attempt_id=" + encodeURIComponent(String(sessionId))
      : "attempt_id=" + encodeURIComponent(String(sessionId));
    var url =
      ACTIVE_TEST_URL +
      "?" +
      sessionQuery +
      "&passage_id=" +
      encodeURIComponent(String(passageId)) +
      "&question_number=" +
      encodeURIComponent(String(questionNumber)) +
      "&section_review=1";
    if (reviewAll) {
      url += "&review_all=1";
    }
    return url;
  }

  function rememberSectionReviewContext(sessionId, passageId, isPassage) {
    var returnQuery = isPassage
      ? "passage_attempt_id=" + encodeURIComponent(String(sessionId))
      : "attempt_id=" + encodeURIComponent(String(sessionId));
    localStorage.setItem(
      SECTION_REVIEW_CONTEXT_KEY,
      JSON.stringify({
        session_kind: isPassage ? "passage" : "test",
        attempt_id: isPassage ? null : sessionId,
        passage_attempt_id: isPassage ? sessionId : null,
        passage_id: passageId,
        return_url:
          SECTION_REVIEW_URL +
          "?" +
          returnQuery +
          "&passage_id=" +
          encodeURIComponent(String(passageId)),
      }),
    );
  }

  function getRowListContainer() {
    if (ROW_LIST_LAYOUT.container) return ROW_LIST_LAYOUT.container;
    var marked = document.querySelector("[data-section-review-list]");
    if (marked) {
      if (marked.classList.contains("div-block-255")) {
        return marked.parentElement || document.querySelector(".div-block-252");
      }
      return marked;
    }
    return (
      document.querySelector(".div-block-252") ||
      document.querySelector("[data-section-review-table-body]")
    );
  }

  function getRowTemplate() {
    if (ROW_LIST_LAYOUT.template) return ROW_LIST_LAYOUT.template;
    var explicit = document.querySelector("[data-section-review-row-template]");
    if (explicit) return explicit;
    var marked = document.querySelector("[data-section-review-list]");
    if (marked && marked.classList.contains("div-block-255")) return marked;
    var container = getRowListContainer();
    if (!container) return null;
    return container.querySelector(".div-block-255");
  }

  function ensureRowListLayout() {
    if (ROW_LIST_LAYOUT.container && ROW_LIST_LAYOUT.template) {
      return ROW_LIST_LAYOUT;
    }
    var container = getRowListContainer();
    var template = getRowTemplate();
    if (!container || !template) return null;
    if (template.getAttribute("data-section-review-list")) {
      template.removeAttribute("data-section-review-list");
      if (!container.getAttribute("data-section-review-list")) {
        container.setAttribute("data-section-review-list", "");
      }
    }
    if (!template.hasAttribute("data-section-review-row-template")) {
      template.setAttribute("data-section-review-row-template", "");
    }
    template.style.display = "none";
    template.setAttribute("aria-hidden", "true");
    ROW_LIST_LAYOUT.container = container;
    ROW_LIST_LAYOUT.template = template;
    captureRowStatusStyles(template);
    return ROW_LIST_LAYOUT;
  }

  function clearRenderedRows(container, template) {
    if (!container) return;
    container.querySelectorAll("[data-section-review-row]").forEach(function (row) {
      if (row !== template) row.remove();
    });
    Array.from(container.querySelectorAll(".div-block-255")).forEach(function (row) {
      if (row !== template && !row.hasAttribute("data-section-review-row-template")) {
        row.remove();
      }
    });
  }

  function getQuestionTitle(item) {
    var stem = String((item && (item.stem || item.question_title)) || "").trim();
    if (stem) return stem;
    return "Question " + (item && item.global_question_number);
  }

  function getReviewStatusEl(row) {
    return (
      row.querySelector("[data-section-review-status]") ||
      row.querySelector(".text-block-98")
    );
  }

  function getReviewFlagEl(row) {
    return (
      row.querySelector("[data-section-review-flag]") ||
      row.querySelector(".text-block-96")
    );
  }

  function captureRowStatusStyles(template) {
    if (ROW_STATUS_STYLE_SNAPSHOT || !template) return;
    var statusEl = getReviewStatusEl(template);
    if (!statusEl) return;

    var baseClasses = statusEl.className
      .split(/\s+/)
      .filter(function (cls) {
        return cls && cls !== INCOMPLETE_STATUS_CLASS;
      })
      .join(" ");
    ROW_STATUS_STYLE_SNAPSHOT = {
      completeTextClasses: baseClasses,
      incompleteTextClasses: (baseClasses + " " + INCOMPLETE_STATUS_CLASS).trim(),
    };
  }

  function applyRowStatusStyles(statusEl, status) {
    if (!statusEl) return;
    statusEl.textContent = getStatusLabel(status);
    if (status === "complete") {
      if (ROW_STATUS_STYLE_SNAPSHOT) {
        statusEl.className = ROW_STATUS_STYLE_SNAPSHOT.completeTextClasses;
      } else {
        statusEl.classList.remove(INCOMPLETE_STATUS_CLASS);
      }
      return;
    }
    if (ROW_STATUS_STYLE_SNAPSHOT) {
      statusEl.className = ROW_STATUS_STYLE_SNAPSHOT.incompleteTextClasses;
      return;
    }
    statusEl.classList.add(INCOMPLETE_STATUS_CLASS);
  }

  function captureFilterTabLabels() {
    if (FILTER_TAB_LABELS) return FILTER_TAB_LABELS;
    var allLabel = document.querySelector(".text-block-88");
    var incompleteChip = document.querySelector(".div-block-250");
    if (!allLabel || !incompleteChip) return null;
    var incompleteLabel =
      incompleteChip.querySelector("[data-section-review-filter-label]") ||
      incompleteChip.querySelector(".text-block") ||
      incompleteChip;
    FILTER_TAB_LABELS = {
      all: allLabel,
      incomplete: incompleteLabel,
    };
    return FILTER_TAB_LABELS;
  }

  function captureTabStyleSnapshot() {
    if (TAB_STYLE_SNAPSHOT) return TAB_STYLE_SNAPSHOT;
    var allTab = document.querySelector(".text-block-88");
    var incompleteTab = document.querySelector(".div-block-250");
    if (!allTab || !incompleteTab) return null;
    TAB_STYLE_SNAPSHOT = {
      allTab: allTab,
      incompleteTab: incompleteTab,
      allClasses: allTab.className,
      incompleteClasses: incompleteTab.className,
    };
    return TAB_STYLE_SNAPSHOT;
  }

  function applyFilterTabPresentation(activeFilter) {
    var snapshot = captureTabStyleSnapshot();
    if (!snapshot) return;
    if (activeFilter === "incomplete") {
      snapshot.allTab.className = snapshot.incompleteClasses;
      snapshot.incompleteTab.className = snapshot.allClasses;
      return;
    }
    snapshot.allTab.className = snapshot.allClasses;
    snapshot.incompleteTab.className = snapshot.incompleteClasses;
  }

  function fillReviewRow(row, item, summary, attemptId) {
    var status = getQuestionStatus(item);
    var title = getQuestionTitle(item);

    row.style.display = "";
    row.removeAttribute("aria-hidden");
    row.setAttribute("data-section-review-row", "");
    row.setAttribute(
      "data-question-number",
      String(item.global_question_number),
    );
    var questionEl =
      row.querySelector("[data-section-review-question]") ||
      row.querySelector(".text-block-93");
    if (questionEl) {
      questionEl.textContent = "Question " + item.global_question_number;
    }

    var titleEl =
      row.querySelector("[data-section-review-title]") ||
      row.querySelector(".text-block-94");
    if (titleEl) {
      titleEl.textContent = title;
    }

    var statusEl = getReviewStatusEl(row);
    var flagEl = getReviewFlagEl(row);

    applyRowStatusStyles(statusEl, status);
    if (flagEl) {
      flagEl.textContent = item.is_flagged ? "⚑" : "—";
      flagEl.classList.toggle("nav-flag-flagged", Boolean(item.is_flagged));
    }

    var reviewLink =
      row.querySelector("[data-section-review-link]") ||
      row.querySelector(".text-block-97");
    if (reviewLink) {
      reviewLink.style.cursor = "pointer";
      reviewLink.onclick = function (event) {
        event.preventDefault();
        if (!attemptId) return;
        navigateToActiveTestFromSectionReview(
          attemptId,
          summary.passage_id,
          item.global_question_number,
          null,
          isPassageSession(CURRENT_CONTENT),
        );
      };
    }
  }

  function normalizeFilterLabel(text) {
    return String(text || "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .trim()
      .toLowerCase();
  }

  function setFilterLabel(kind, baseLabel, count) {
    var labels = captureFilterTabLabels();
    if (!labels) return;
    var labelNode = kind === "all" ? labels.all : labels.incomplete;
    if (!labelNode) return;
    labelNode.textContent = baseLabel + " (" + count + ")";
  }

  function findFilterTab(kind) {
    var byAttr = document.querySelector(
      '[data-section-review-filter="' + kind + '"]',
    );
    if (byAttr) return byAttr;

    if (kind === "all") {
      var allLabel = document.querySelector(".text-block-88");
      if (allLabel && allLabel.parentElement) return allLabel.parentElement;
      if (allLabel) return allLabel;
    }
    if (kind === "incomplete") {
      var incompleteTab = document.querySelector(".div-block-250");
      if (incompleteTab) return incompleteTab;
    }

    var candidates = Array.from(
      document.querySelectorAll("p, div, span, a"),
    );
    for (var i = 0; i < candidates.length; i += 1) {
      var el = candidates[i];
      if (normalizeFilterLabel(el.textContent || "") === kind) return el;
    }
    return null;
  }

  function renderFilterTabs(counts) {
    var tabs = [
      { kind: "all", label: "All", count: counts.all },
      {
        kind: "incomplete",
        label: "Incomplete",
        count: counts.incomplete,
      },
    ];

    tabs.forEach(function (tab) {
      var node = findFilterTab(tab.kind);
      if (!node) return;
      setFilterLabel(tab.kind, tab.label, tab.count);
      node.setAttribute(
        "aria-selected",
        tab.kind === CURRENT_FILTER ? "true" : "false",
      );
    });
    applyFilterTabPresentation(CURRENT_FILTER);
  }

  function renderRows(summary, filter) {
    var layout = ensureRowListLayout();
    if (!layout || !layout.container || !layout.template || !summary) return;

    var container = layout.container;
    var template = layout.template;
    var items = getFilteredItems(summary.items, filter);
    var fragment = document.createDocumentFragment();
    var attemptId = CURRENT_CONTENT && getContentSessionId(CURRENT_CONTENT);

    clearRenderedRows(container, template);

    items.forEach(function (item) {
      var row = template.cloneNode(true);
      fillReviewRow(row, item, summary, attemptId);
      fragment.appendChild(row);
    });

    container.appendChild(fragment);
  }

  function sectionCodeForSummary(summary, content) {
    if (summary && summary.passage_section) {
      return String(summary.passage_section).trim();
    }
    if (content && content.exam_section) {
      return String(content.exam_section).trim();
    }
    if (
      content &&
      content.current_passage &&
      content.current_passage.section != null
    ) {
      return String(content.current_passage.section).trim();
    }
    return "CARS";
  }

  /** Maps passages.section / attempt exam_section to footer label. */
  function sectionProgressLabel(sectionCode) {
    var key = String(sectionCode || "")
      .trim()
      .toUpperCase();
    if (key === "BB" || key === "B/B" || key === "BIO/BIOCHEM") {
      return "Bio/Biochem Section";
    }
    if (key === "CARS") return "CARS Section";
    if (key === "MIXED") return "Mixed Section";
    return key.replace(/_/g, " ") + " Section";
  }

  function getSectionPassageSurveyStore() {
    var raw = localStorage.getItem(SECTION_PASSAGE_SURVEY_STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (_) {
      return {};
    }
  }

  function setSectionPassageSurveyStore(store) {
    localStorage.setItem(
      SECTION_PASSAGE_SURVEY_STORAGE_KEY,
      JSON.stringify(store || {}),
    );
  }

  function getSectionPassageSurveyKey(sessionId, passageId) {
    return String(sessionId || "") + ":" + String(passageId || "");
  }

  function getRatingButtons(groupEl) {
    if (!groupEl) return [];
    return Array.prototype.slice.call(
      groupEl.querySelectorAll(".div-block-266, [data-survey-value]"),
    );
  }

  function readButtonValue(btn) {
    if (!btn) return null;
    var raw = btn.getAttribute("data-survey-value");
    if (raw) {
      var parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }
    var text = (btn.textContent || "").replace(/\s+/g, " ").trim();
    var match = text.match(/\b([1-9]|10)\b/);
    return match ? Number(match[1]) : null;
  }

  function readRatingGroupValue(groupEl) {
    if (!groupEl) return null;
    var buttons = getRatingButtons(groupEl);
    for (var i = 0; i < buttons.length; i += 1) {
      if (buttons[i].classList.contains("active")) {
        return readButtonValue(buttons[i]);
      }
    }
    return null;
  }

  function applySavedRating(groupEl, value) {
    if (!groupEl || value == null) return;
    getRatingButtons(groupEl).forEach(function (btn) {
      btn.classList.toggle("active", readButtonValue(btn) === Number(value));
    });
  }

  function getSectionPassageSurveyRows() {
    var explicit = Array.prototype.slice.call(
      document.querySelectorAll("[data-survey-passage-row]"),
    );
    if (explicit.length > 0) return explicit;

    var container = document.querySelector("[data-survey-passage-rows]");
    if (container) {
      var childRows = Array.prototype.slice
        .call(container.children)
        .filter(function (node) {
          return node && getRatingButtons(node).length > 0;
        });
      if (childRows.length > 0) return childRows;
    }

    return Array.prototype.slice
      .call(document.querySelectorAll(".div-block-264, .div-block-267, tr"))
      .filter(function (node) {
        return node && getRatingButtons(node).length >= 5;
      });
  }

  function setSectionPassageSurveyRowLabel(row, summary) {
    if (!row || !summary) return;
    var labelEl =
      row.querySelector("[data-survey-passage-label]") ||
      row.querySelector(".text-block-106.bodytable") ||
      row.querySelector(".text-block-106") ||
      row.querySelector("td:first-child");
    if (!labelEl) return;
    labelEl.textContent =
      "P" +
      String(summary.position || "") +
      " - " +
      String(summary.passage_title || "Passage").toUpperCase();
  }

  function getPassageMetricGroups(row) {
    if (!row) return [];
    var labeled = Array.prototype.slice.call(row.querySelectorAll("[data-metric]"));
    if (labeled.length > 0) return labeled.slice(0, PASSAGE_SURVEY_METRICS.length);

    var groups = [];
    row.querySelectorAll(".div-block-268").forEach(function (node) {
      if (getRatingButtons(node).length > 0) groups.push(node);
    });
    if (groups.length >= PASSAGE_SURVEY_METRICS.length) {
      return groups.slice(0, PASSAGE_SURVEY_METRICS.length);
    }

    groups = Array.prototype.slice
      .call(row.querySelectorAll(".div-block-265.intb"))
      .filter(function (node) {
        return getRatingButtons(node).length > 0;
      });
    if (groups.length >= PASSAGE_SURVEY_METRICS.length) {
      return groups.slice(0, PASSAGE_SURVEY_METRICS.length);
    }

    return Array.prototype.slice
      .call(row.querySelectorAll("[data-survey-rating-group]"))
      .slice(0, PASSAGE_SURVEY_METRICS.length);
  }

  function assignPassageSurveyMetrics(row) {
    var groups = getPassageMetricGroups(row);
    groups.forEach(function (groupEl, index) {
      var metric = PASSAGE_SURVEY_METRICS[index];
      if (!metric) return;
      groupEl.setAttribute("data-metric", metric);
      groupEl.setAttribute("data-survey-rating-group", "");
    });
    return groups;
  }

  function collectSectionPassageSurveyRating() {
    if (!CURRENT_SUMMARY) return null;
    var row = document.querySelector("[data-section-current-passage-survey]");
    if (!row) return null;

    var item = { passage_id: CURRENT_SUMMARY.passage_id };
    PASSAGE_SURVEY_METRICS.forEach(function (metric) {
      item[metric] = readRatingGroupValue(
        row.querySelector('[data-metric="' + metric + '"]'),
      );
    });
    return item;
  }

  function persistSectionPassageSurveyRating() {
    var item = collectSectionPassageSurveyRating();
    var sessionId = getContentSessionId(CURRENT_CONTENT);
    if (!item || !sessionId || !item.passage_id) return;
    var store = getSectionPassageSurveyStore();
    store[getSectionPassageSurveyKey(sessionId, item.passage_id)] = item;
    setSectionPassageSurveyStore(store);
  }

  function wireSectionPassageRatingGroup(groupEl) {
    if (!groupEl || groupEl.dataset.sectionPassageSurveyWired === "1") return;
    groupEl.dataset.sectionPassageSurveyWired = "1";
    groupEl.setAttribute("data-survey-rating-group", "");

    var buttons = getRatingButtons(groupEl);
    buttons.forEach(function (btn) {
      if (btn.dataset.sectionPassageSurveyClickWired === "1") return;
      btn.dataset.sectionPassageSurveyClickWired = "1";
      btn.style.cursor = "pointer";
      btn.setAttribute("role", "button");
      btn.setAttribute("tabindex", "0");

      btn.addEventListener("click", function (event) {
        event.preventDefault();
        if (btn.classList.contains("active")) {
          btn.classList.remove("active");
        } else {
          buttons.forEach(function (other) {
            other.classList.remove("active");
          });
          btn.classList.add("active");
        }
        persistSectionPassageSurveyRating();
      });

      btn.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        btn.click();
      });
    });
  }

  function setupSectionPassageSurvey(summary, content) {
    var rows = getSectionPassageSurveyRows();
    if (!summary || !content || rows.length === 0) return;

    var row = rows[0];
    rows.slice(1).forEach(function (extraRow) {
      extraRow.style.display = "none";
      extraRow.setAttribute("aria-hidden", "true");
    });

    row.style.display = "";
    row.setAttribute("aria-hidden", "false");
    row.setAttribute("data-survey-passage-row", "");
    row.setAttribute("data-section-current-passage-survey", "");
    row.setAttribute("data-passage-id", summary.passage_id);
    setSectionPassageSurveyRowLabel(row, summary);

    var groups = assignPassageSurveyMetrics(row);
    groups.forEach(wireSectionPassageRatingGroup);

    var sessionId = getContentSessionId(content);
    var saved =
      getSectionPassageSurveyStore()[
        getSectionPassageSurveyKey(sessionId, summary.passage_id)
      ] || {};
    PASSAGE_SURVEY_METRICS.forEach(function (metric) {
      applySavedRating(row.querySelector('[data-metric="' + metric + '"]'), saved[metric]);
    });
  }

  function saveCurrentSectionPassageSurvey() {
    if (!CURRENT_CONTENT || !CURRENT_SUMMARY) return Promise.resolve();
    var userId = getPortalUserId();
    var sessionId = getContentSessionId(CURRENT_CONTENT);
    var attemptId =
      CURRENT_CONTENT.attempt_id || (!isPassageSession(CURRENT_CONTENT) ? sessionId : null);
    var item = collectSectionPassageSurveyRating();
    if (!userId || !sessionId || !item || !item.passage_id) {
      return Promise.resolve();
    }

    persistSectionPassageSurveyRating();
    if (!attemptId) return Promise.resolve();

    var payload = {
      user_id: userId,
      attempt_id: attemptId,
      passage_only: true,
      skipped: false,
      passage_ratings: [item],
    };

    return postToFunction(SAVE_SURVEY_FUNCTION_URL, payload).catch(function (err) {
      console.error("Failed to save passage ratings:", err);
    });
  }

  function renderSummary(summary, content) {
    if (!summary || !content) return;
    var counts = getFilterCounts(summary.items);
    var completed = summary.items.filter(function (item) {
      return Boolean(item.selected_choice);
    }).length;

    setText("[data-section-review-title]", "Section Review");
    var sectionLabel = sectionProgressLabel(
      sectionCodeForSummary(summary, content),
    );
    setText(
      "[data-section-review-progress]",
      sectionLabel +
        " - " +
        completed +
        " of " +
        summary.items.length +
        " questions complete",
    );
    setText(
      "[data-section-review-passage-label]",
      summary.passage_title || "Passage " + summary.position,
    );

    renderFilterTabs(counts);
    renderRows(summary, CURRENT_FILTER);
    setupSectionPassageSurvey(summary, content);
  }

  function openInstructions() {
    var modal = document.querySelector("[data-section-instructions-modal]");
    if (!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }

  function closeInstructions() {
    var modal = document.querySelector("[data-section-instructions-modal]");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  function showBreakPanel(summary, breakSeconds) {
    var panel = document.querySelector("[data-section-break-panel]");
    if (!panel) return;
    var seconds = Math.max(0, Number(breakSeconds || 0));
    var minutes = Math.max(1, Math.floor(seconds / 60));
    setText(
      "[data-section-break-message]",
      "You may take an optional break of up to " +
        minutes +
        " minutes. This break does not count toward your exam time.",
    );
    setText("[data-section-break-timer]", formatDuration(seconds));
    panel.style.display = "flex";
    panel.setAttribute("aria-hidden", "false");
  }

  function hideBreakPanel() {
    var panel = document.querySelector("[data-section-break-panel]");
    if (!panel) return;
    panel.style.display = "none";
    panel.setAttribute("aria-hidden", "true");
  }

  function beginOptionalPassageBreak(summary) {
    if (!summary || !CURRENT_CONTENT) return;
    var attemptId = getContentSessionId(CURRENT_CONTENT);
    var passageId = summary.passage_id;

    if (hasPassageBreakCompleted(attemptId, passageId)) {
      stopBreakCountdown();
      hideBreakPanel();
      setBreakTimeHeader(null);
      return;
    }

    var breakSeconds = getBreakSecondsForPassage(summary.position);
    var remaining = breakSeconds;
    setBreakTimeHeader(remaining);
    showBreakPanel(summary, breakSeconds);

    stopBreakCountdown();
    BREAK_INTERVAL_ID = setInterval(function () {
      remaining = Math.max(remaining - 1, 0);
      setBreakTimeHeader(remaining);
      setText("[data-section-break-timer]", formatDuration(remaining));
      if (remaining === 0) {
        stopBreakCountdown();
        continueAfterBreak(summary);
      }
    }, 1000);
  }

  function clearAttemptPassageMarkup(attemptId) {
    if (!attemptId) return;
    var raw = localStorage.getItem(PASSAGE_ANNOTATIONS_STORAGE_KEY);
    if (!raw) return;
    try {
      var store = JSON.parse(raw) || {};
      if (store[attemptId]) {
        delete store[attemptId];
        localStorage.setItem(
          PASSAGE_ANNOTATIONS_STORAGE_KEY,
          JSON.stringify(store),
        );
      }
    } catch (_) {
      return;
    }
  }

  function buildAttemptDraftPayload(attemptId) {
    var raw = localStorage.getItem(ATTEMPT_ANSWERS_STORAGE_KEY);
    var map = {};
    if (raw) {
      try {
        map = JSON.parse(raw) || {};
      } catch (_) {
        map = {};
      }
    }

    var answers = [];
    Object.keys(map).forEach(function (qid) {
      var item = map[qid];
      if (
        item &&
        item.attempt_id === attemptId &&
        item.selected_choice
      ) {
        answers.push({
          question_id: qid,
          selected_choice: item.selected_choice,
          selected_at: item.selected_at || null,
        });
      }
    });

    var events = [];
    var rawEvents = localStorage.getItem(ATTEMPT_ANSWER_EVENTS_STORAGE_KEY);
    if (rawEvents) {
      try {
        events = (JSON.parse(rawEvents) || []).filter(function (ev) {
          return ev && ev.attempt_id === attemptId;
        });
      } catch (_) {
        events = [];
      }
    }

    return {
      answers: answers,
      answer_events: events,
      question_dwell_seconds: getQuestionDwellSecondsForAttempt(attemptId),
    };
  }

  async function continueAfterBreak(summary) {
    stopBreakCountdown();
    hideBreakPanel();
    setBreakTimeHeader(null);
    if (!CURRENT_CONTENT || !summary) return;

    var sessionId = getContentSessionId(CURRENT_CONTENT);
    var passageSession = isPassageSession(CURRENT_CONTENT);
    markPassageBreakCompleted(sessionId, summary.passage_id);
    var summaries = getPassageSummaries(CURRENT_CONTENT);
    var isLastPassage = summary.position >= summaries.length;
    var remaining =
      (loadTimerSnapshot() && loadTimerSnapshot().remaining_seconds) ||
      Number(CURRENT_CONTENT.remaining_seconds || 0);

    resumeExamTimer(sessionId, remaining);
    await saveCurrentSectionPassageSurvey();

    if (isLastPassage) {
      var userId = getPortalUserId();
      if (!userId || !sessionId) return;
      var draft = buildAttemptDraftPayload(sessionId);
      clearAttemptPassageMarkup(sessionId);
      if (passageSession) {
        localStorage.setItem(
          PASSAGE_SUBMIT_DRAFT_KEY,
          JSON.stringify({
            user_id: userId,
            passage_attempt_id: sessionId,
            answers: draft.answers,
            answer_events: draft.answer_events,
            question_dwell_seconds: draft.question_dwell_seconds || {},
          }),
        );
        window.location.href =
          SCORE_REPORT_URL +
          "?passage_attempt_id=" +
          encodeURIComponent(String(sessionId));
        return;
      }
      localStorage.setItem(
        "portal_attempt_submit_draft",
        JSON.stringify({
          user_id: userId,
          attempt_id: sessionId,
          answers: draft.answers,
          answer_events: draft.answer_events,
          question_dwell_seconds: draft.question_dwell_seconds || {},
        }),
      );
      window.location.href =
        POST_TEST_SURVEY_URL + "?attempt_id=" + encodeURIComponent(String(sessionId));
      return;
    }

    setAllowedSectionPosition(sessionId, summary.position + 1);
    var nextUrl =
      passageSession
        ? ACTIVE_TEST_URL +
          "?passage_attempt_id=" +
          encodeURIComponent(String(sessionId)) +
          "&question_number=" +
          encodeURIComponent(String(summary.question_end + 1))
        : ACTIVE_TEST_URL +
          "?attempt_id=" +
          encodeURIComponent(String(sessionId)) +
          "&question_number=" +
          encodeURIComponent(String(summary.question_end + 1));
    window.location.href = nextUrl;
  }

  function wireFilterTabs() {
    function bindFilterTab(node, filter) {
      if (!node || node.dataset.sectionReviewFilterWired === "1") return;
      node.dataset.sectionReviewFilterWired = "1";
      node.style.cursor = "pointer";
      node.addEventListener("click", function (event) {
        event.preventDefault();
        CURRENT_FILTER = filter;
        if (!CURRENT_SUMMARY || !CURRENT_CONTENT) return;
        renderSummary(CURRENT_SUMMARY, CURRENT_CONTENT);
      });
    }

    document
      .querySelectorAll("[data-section-review-filter]")
      .forEach(function (tab) {
        bindFilterTab(
          tab,
          String(tab.getAttribute("data-section-review-filter") || "all"),
        );
      });

    bindFilterTab(findFilterTab("all"), "all");
    bindFilterTab(findFilterTab("incomplete"), "incomplete");
  }

  function wireReviewAllButton() {
    var button = document.querySelector("[data-section-review-all-button]");
    if (!button) return;
    button.addEventListener("click", function (event) {
      event.preventDefault();
      if (!CURRENT_CONTENT || !CURRENT_SUMMARY) return;
      navigateToActiveTestFromSectionReview(
        getContentSessionId(CURRENT_CONTENT),
        CURRENT_SUMMARY.passage_id,
        CURRENT_SUMMARY.question_start,
        { reviewAll: true },
        isPassageSession(CURRENT_CONTENT),
      );
    });
  }

  function wireEndSectionButton() {
    var button = document.querySelector("[data-end-section-button]");
    if (!button) {
      button = Array.from(document.querySelectorAll("button,a,div")).find(
        function (el) {
          return /end\s*section/i.test((el.textContent || "").trim());
        },
      );
    }
    if (!button) return;
    button.addEventListener("click", function (event) {
      event.preventDefault();
      if (!CURRENT_SUMMARY) return;
      continueAfterBreak(CURRENT_SUMMARY);
    });
  }

  function wireBreakButtons() {
    var skip = document.querySelector("[data-section-break-skip]");
    if (skip) {
      skip.addEventListener("click", function (event) {
        event.preventDefault();
        continueAfterBreak(CURRENT_SUMMARY);
      });
    }
    var continueBtn = document.querySelector("[data-section-break-continue]");
    if (continueBtn) {
      continueBtn.addEventListener("click", function (event) {
        event.preventDefault();
        continueAfterBreak(CURRENT_SUMMARY);
      });
    }
  }

  function wireInstructions() {
    document
      .querySelectorAll("[data-section-instructions-open]")
      .forEach(function (btn) {
        btn.addEventListener("click", function (event) {
          event.preventDefault();
          openInstructions();
        });
      });
    document
      .querySelectorAll("[data-section-instructions-close]")
      .forEach(function (btn) {
        btn.addEventListener("click", function (event) {
          event.preventDefault();
          closeInstructions();
        });
      });
    var modal = document.querySelector("[data-section-instructions-modal]");
    if (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target === modal) closeInstructions();
      });
    }
  }

  function wireKeyboardShortcuts() {
    document.addEventListener("keydown", function (event) {
      if (!event.altKey) return;
      var key = String(event.key || "").toLowerCase();
      if (key === "a") {
        event.preventDefault();
        if (!CURRENT_CONTENT || !CURRENT_SUMMARY) return;
        navigateToActiveTestFromSectionReview(
          getContentSessionId(CURRENT_CONTENT),
          CURRENT_SUMMARY.passage_id,
          CURRENT_SUMMARY.question_start,
          { reviewAll: true },
          isPassageSession(CURRENT_CONTENT),
        );
        return;
      }
      if (key === "i") {
        event.preventDefault();
        CURRENT_FILTER = "incomplete";
        renderSummary(CURRENT_SUMMARY, CURRENT_CONTENT);
        return;
      }
      if (key === "u") {
        event.preventDefault();
        CURRENT_FILTER = "unseen";
        renderSummary(CURRENT_SUMMARY, CURRENT_CONTENT);
        return;
      }
      if (key === "r") {
        event.preventDefault();
        CURRENT_FILTER = "flagged";
        renderSummary(CURRENT_SUMMARY, CURRENT_CONTENT);
        return;
      }
      if (key === "f") {
        event.preventDefault();
        if (CURRENT_SUMMARY) continueAfterBreak(CURRENT_SUMMARY);
        return;
      }
      if (key === "o") {
        event.preventDefault();
        openInstructions();
        return;
      }
      if (key === "c") {
        event.preventDefault();
        closeInstructions();
      }
    });
  }

  function injectUiOverrides() {
    if (document.getElementById("section-review-ui-overrides")) return;
    var style = document.createElement("style");
    style.id = "section-review-ui-overrides";
    style.textContent =
      "[data-section-review-flag].nav-flag-flagged{color:#e00!important;}";
    (document.head || document.documentElement).appendChild(style);
  }

  async function init() {
    injectUiOverrides();
    var userId = getPortalUserId();
    if (!userId) return;
    applyPortalUserToHeader();

    var passageAttemptId = getPassageAttemptId();
    var attemptId = getAttemptId();
    var payload = { user_id: userId };
    if (passageAttemptId) payload.passage_attempt_id = passageAttemptId;
    else if (attemptId) payload.attempt_id = attemptId;
    var passageIdForContent = getPassageId();
    if (passageIdForContent) payload.passage_id = passageIdForContent;

    var content = await postToFunction(
      ACTIVE_TEST_CONTENT_FUNCTION_URL,
      payload,
    );
    if (!content || !Array.isArray(content.navigation_items)) return;

    syncAttemptAnswersFromContent(content);
    content = mergeLocalAttemptAnswersIntoContent(content);

    var summaries = getPassageSummaries(content);
    if (summaries.length === 0) return;

    var passageId = getPassageId();
    var summary =
      summaries.find(function (entry) {
        return entry.passage_id === passageId;
      }) ||
      summaries[
        Math.max(0, getAllowedSectionPosition(getContentSessionId(content)) - 1)
      ];

    if (!summary) return;

    CURRENT_CONTENT = content;
    CURRENT_SUMMARY = summary;
    CURRENT_FILTER = "all";

    var contentSessionId = getContentSessionId(content);
    rememberSectionReviewContext(
      contentSessionId,
      summary.passage_id,
      isPassageSession(content),
    );

    var activeAttempt = await postToFunction(
      ACTIVE_ATTEMPT_FUNCTION_URL,
      withSessionPayload({ user_id: userId }, content),
    );
    var remaining = Number(
      (loadTimerSnapshot() && loadTimerSnapshot().remaining_seconds) ||
        activeAttempt.remaining_seconds ||
        0,
    );
    pauseExamTimer(contentSessionId, remaining);
    setQuestionProgress(
      countAnsweredQuestions(content),
      Number(content.total_questions || 0),
    );

    ensureRowListLayout();
    renderSummary(summary, content);
    beginOptionalPassageBreak(summary);
    wireFilterTabs();
    wireReviewAllButton();
    wireEndSectionButton();
    wireBreakButtons();
    wireInstructions();
    wireKeyboardShortcuts();
  }

  function setQuestionProgress(answered, total) {
    var text = String(answered || 0) + " of " + String(total || 0);
    setText("[data-question-progress]", text);
    setText("[question-progress]", text);
  }

  document.addEventListener("DOMContentLoaded", function () {
    showPageLoader();
    init()
      .catch(function (err) {
        console.error("Section review init error:", err);
      })
      .finally(function () {
        hidePageLoader();
      });
  });
})();
