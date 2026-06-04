/* Wizard step pills — validation + navigation (passage + question modals on this site) */
(function (global) {
  var STYLE_ID = "admin-wizard-notification-style";

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      ".admin-wizard-notification{box-sizing:border-box;margin:0 22px 12px;padding:12px 14px;" +
      "border-radius:8px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;font-size:13px;line-height:1.45;}" +
      ".admin-wizard-notification strong{display:block;margin-bottom:6px;font-size:13px;}" +
      ".admin-wizard-notification ul{margin:0;padding-left:18px;}" +
      ".admin-wizard-notification li{margin:2px 0;}";
    (document.head || document.documentElement).appendChild(style);
  }

  function hideNotification(modal) {
    if (!modal) return;
    var el = modal.querySelector(".admin-wizard-notification");
    if (el) el.remove();
  }

  function showNotification(modal, messages) {
    ensureStyles();
    if (!modal) return;
    hideNotification(modal);
    var list = Array.isArray(messages) ? messages : [String(messages)];
    if (!list.length) return;
    var host = modal.querySelector(".admin-passage-wizard-steps");
    var note = document.createElement("div");
    note.className = "admin-wizard-notification";
    note.setAttribute("role", "alert");
    note.innerHTML =
      "<strong>Please complete required fields</strong><ul>" +
      list
        .map(function (msg) {
          return "<li>" + escapeHtml(msg) + "</li>";
        })
        .join("") +
      "</ul>";
    if (host && host.parentNode) {
      host.insertAdjacentElement("afterend", note);
    } else {
      var body = modal.querySelector(".admin-passage-wizard-body");
      if (body) body.insertAdjacentElement("beforebegin", note);
      else modal.appendChild(note);
    }
    note.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function validateQuestionStep1(q) {
    var errors = [];
    q = q || {};
    if (!String(q.question_type || "").trim()) errors.push("Question type is required");
    if (!String(q.stem || "").trim()) errors.push("Question stem is required");
    ["A", "B", "C", "D"].forEach(function (letter) {
      if (!String((q.choices && q.choices[letter]) || "").trim()) {
        errors.push("Choice " + letter + " is required");
      }
    });
    return errors;
  }

  function validateQuestionStep2(q) {
    var correct = String((q && q.correct_choice) || "")
      .trim()
      .toUpperCase();
    if (["A", "B", "C", "D"].indexOf(correct) < 0) {
      return ["Correct answer (A–D) is required"];
    }
    return [];
  }

  function validatePassageStep1(passage) {
    var errors = [];
    passage = passage || {};
    if (!String(passage.passage_code || "").trim()) {
      errors.push("Passage code is required");
    }
    if (!String(passage.title || "").trim()) errors.push("Title is required");
    if (!String(passage.body || "").trim()) errors.push("Passage body is required");
    return errors;
  }

  function validatePassageStep2(questions) {
    var errors = [];
    if (!Array.isArray(questions) || !questions.length) {
      errors.push("At least one question is required");
      return errors;
    }
    questions.forEach(function (q, index) {
      var n = index + 1;
      if (!String(q.stem || "").trim()) {
        errors.push("Question " + n + ": stem is required");
      }
      ["A", "B", "C", "D"].forEach(function (letter) {
        if (!String((q.choices && q.choices[letter]) || "").trim()) {
          errors.push("Question " + n + ": choice " + letter + " is required");
        }
      });
    });
    return errors;
  }

  function validatePassageStep3(questions) {
    var errors = [];
    (questions || []).forEach(function (q, index) {
      var correct = String(q.correct_choice || "")
        .trim()
        .toUpperCase();
      if (["A", "B", "C", "D"].indexOf(correct) < 0) {
        errors.push(
          "Question " + (index + 1) + ": correct answer (A–D) is required",
        );
      }
    });
    return errors;
  }

  function validateStep(mode, step, data) {
    data = data || {};
    if (mode === "question") {
      if (step === 1) return validateQuestionStep1(data.question);
      if (step === 2) return validateQuestionStep2(data.question);
    }
    if (mode === "passage") {
      if (step === 1) return validatePassageStep1(data.passage);
      if (step === 2) return validatePassageStep2(data.questions);
      if (step === 3) return validatePassageStep3(data.questions);
    }
    return [];
  }

  function goToStep(options) {
    var modal = options.modal;
    var target = Number(options.targetStep);
    var maxStep = Number(options.maxStep);
    var current = Number(options.getStep());
    if (!modal || !Number.isFinite(target) || target < 1 || target > maxStep) {
      return false;
    }
    if (target === current) return true;
    if (typeof options.readCurrentStep === "function") {
      options.readCurrentStep(modal);
    }
    if (target < current) {
      hideNotification(modal);
      options.setStep(target);
      options.refreshNav();
      return true;
    }
    for (var step = current; step < target; step += 1) {
      var errors = validateStep(options.mode, step, options.getData());
      if (errors.length) {
        showNotification(modal, errors);
        options.setStep(step);
        options.refreshNav();
        return false;
      }
    }
    hideNotification(modal);
    options.setStep(target);
    options.refreshNav();
    return true;
  }

  function wireStepPills(options) {
    var modal = options.modal;
    if (!modal) return;
    modal.querySelectorAll(".admin-passage-wizard-step-pill").forEach(function (pill) {
      if (pill.dataset.wizardStepWired === "1") return;
      pill.dataset.wizardStepWired = "1";
      pill.setAttribute("role", "button");
      pill.setAttribute("tabindex", "0");
      function activate() {
        goToStep({
          modal: modal,
          mode: options.mode,
          maxStep: options.maxStep,
          targetStep: Number(pill.getAttribute("data-step")),
          getStep: options.getStep,
          setStep: options.setStep,
          getData: options.getData,
          readCurrentStep: options.readCurrentStep,
          refreshNav: options.refreshNav,
        });
      }
      pill.addEventListener("click", function (e) {
        e.preventDefault();
        activate();
      });
      pill.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });
  }

  global.AdminWizardSteps = {
    showNotification: showNotification,
    hideNotification: hideNotification,
    goToStep: goToStep,
    wireStepPills: wireStepPills,
    validateStep: validateStep,
    validateQuestionStep1: validateQuestionStep1,
    validateQuestionStep2: validateQuestionStep2,
    validatePassageStep1: validatePassageStep1,
    validatePassageStep2: validatePassageStep2,
    validatePassageStep3: validatePassageStep3,
  };
})(typeof window !== "undefined" ? window : globalThis);

!(function () {
  var e = "https://eaxashxpqpihonnuhdpx.supabase.co/functions/v1/",
    t = e + "get-admin-passage-library-stats",
    a = e + "get-admin-passage-library-list",
    n = e + "delete-admin-passage",
    i = e + "admin-passage-wizard",
    Ue = e + "admin-upload-passage-figure",
    r =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheGFzaHhwcXBpaG9ubnVoZHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDk4MzMsImV4cCI6MjA4ODAyNTgzM30.j8n-puyJ6rKDMibSCxteJeWbVpI7xkxFux_njkHXlGg",
    o = "admin-passage-library-loading-overlay",
    s = "admin-passage-library-loading-overlay-style",
    d = "admin-passage-library-preload-style",
    l = "admin-passage-library-ui-styles",
    c = { container: null, template: null },
    u = 0,
    p = !1,
    m = !1,
    f = !1,
    g = "",
    y = !1,
    h = !1,
    b = null,
    v = null,
    _ = {
      open: !1,
      step: 1,
      passageId: null,
      passage: {},
      questions: [],
      figures: [],
    },
    x = [
      { value: "inference", label: "Inference" },
      { value: "application", label: "Application" },
      { value: "reasoning_within", label: "Reasoning Within the Text" },
      { value: "reasoning_beyond", label: "Reasoning Beyond the Text" },
      { value: "foundations", label: "Foundations of Comprehension" },
      { value: "bb_knowledge", label: "BB — Knowledge" },
      { value: "bb_data_interpretation", label: "BB — Data Interpretation" },
      { value: "bb_research_design", label: "BB — Research Design" },
      { value: "bb_reasoning", label: "BB — Reasoning" },
    ];
  function C() {
    var e = localStorage.getItem("portal_user");
    if (!e) return null;
    try {
      return JSON.parse(e);
    } catch (e) {
      return null;
    }
  }
  function A() {
    var e,
      t =
        ((e = C() || {}).name && String(e.name).trim()) ||
        (e.full_name && String(e.full_name).trim()) ||
        [e.first_name, e.last_name].filter(Boolean).join(" ").trim() ||
        (e.email && String(e.email).trim()) ||
        "User Name";
    document
      .querySelectorAll('[data-field="current-user-name"]')
      .forEach(function (e) {
        e.textContent = t;
      });
  }
  function w() {
    var e = localStorage.getItem("portal_user_id");
    if (e) return e;
    var t = C();
    return t && t.id ? t.id : null;
  }
  function E() {
    var e = C();
    return Boolean(e && "admin" === String(e.role || "").toLowerCase());
  }
  var S = "https://www.premedcatalyst.com/test-dashboard",
    q = e + "check-admin-role",
    k = null;
  function D() {
    return window.portalAdminGuard && window.portalAdminGuard.requireAdminAccess
      ? !window.portalAdminGuard.requireAdminAccess()
      : (!w() || !E()) && (window.location.replace(S), !0);
  }
  function B(e, t) {
    document.querySelectorAll(e).forEach(function (e) {
      e.textContent = String(t);
    });
  }
  function I(e, t) {
    return fetch(e, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: r,
        Authorization: "Bearer " + r,
      },
      body: JSON.stringify(t || {}),
    }).then(function (e) {
      return e.json().then(function (t) {
        if (!e.ok) {
          var a = (t && (t.error || t.details)) || "Request failed";
          throw new Error(a);
        }
        return t;
      });
    });
  }
  function L(e) {
    var t = Object.assign({}, e || {});
    return ((t.admin_user_id = w()), t);
  }
  function z() {
    if (!document.getElementById(d)) {
      var e = document.createElement("style");
      ((e.id = d),
        (e.textContent = "body > *:not(#" + o + "){display:none !important;}"),
        (document.head || document.documentElement).appendChild(e));
    }
  }
  function F(e) {
    !(function () {
      if (!document.getElementById(s)) {
        var e = document.createElement("style");
        ((e.id = s),
          (e.textContent =
            "@keyframes admin-passage-loader-spin{to{transform:rotate(360deg)}}"),
          (document.head || document.documentElement).appendChild(e));
      }
    })();
    var t = document.getElementById(o);
    if (t) {
      var a = t.querySelector("[data-admin-loader-title]");
      a && (a.textContent = e || "Loading passage library...");
    } else {
      var n = document.createElement("div");
      ((n.id = o),
        n.setAttribute("role", "status"),
        n.setAttribute("aria-live", "polite"),
        n.setAttribute("aria-busy", "true"),
        (n.style.cssText =
          "position:fixed;inset:0;background:rgba(15,23,42,.62);z-index:99999;display:flex;align-items:center;justify-content:center;"),
        (n.innerHTML =
          '<div style="background:#111827;color:#fff;padding:22px 26px;border-radius:10px;min-width:260px;text-align:center;font-family:Arial,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25);"><div style="width:40px;height:40px;margin:0 auto 14px;border:3px solid rgba(255,162,95,.28);border-top-color:#FFA25F;border-radius:50%;animation:admin-passage-loader-spin .85s linear infinite;" aria-hidden="true"></div><div data-admin-loader-title style="font-size:15px;font-weight:700;margin-bottom:6px;">' +
          (e || "Loading passage library...") +
          '</div><div style="font-size:12px;color:#d1d5db;">Please wait a moment.</div></div>'),
        document.body.appendChild(n));
    }
  }
  function N() {
    var e,
      t = document.getElementById(o);
    (t && t.remove(), (e = document.getElementById(d)) && e.remove());
  }
  var P = "passage-library-filter-fallback-style";
  function T() {
    if (
      ((function () {
        if (!document.getElementById(P)) {
          var e = document.createElement("style");
          ((e.id = P),
            (e.textContent =
              "[data-admin-passage-library-filters],[data-passage-library-filters]{display:flex;flex-wrap:wrap;align-items:center;gap:10px;}.passage-library-filter-bar,[data-admin-passage-library-filters]{padding:14px 20px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;}select[data-passage-filter-difficulty],select[data-passage-filter-publication],select[data-passage-filter-passage-type],select[data-passage-filter-status],[data-admin-passage-library-filters] select,[data-passage-library-filters] select{appearance:none;-webkit-appearance:none;height:40px;min-width:148px;padding:0 36px 0 12px;font-size:13px;font-weight:500;color:#1c1c1c;background:#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2364748b' d='M1 1l5 5 5-5'/%3E%3C/svg%3E\") no-repeat right 12px center;border:1px solid #d1d5db;border-radius:8px;cursor:pointer;box-sizing:border-box;}select[data-passage-filter-difficulty]:focus,select[data-passage-filter-publication]:focus,select[data-passage-filter-passage-type]:focus{outline:none;border-color:#ffa25f;box-shadow:0 0 0 3px rgba(255,162,95,.2);}[data-passage-filter-clear]{height:40px;padding:0 16px;font-size:13px;font-weight:600;color:#374151;background:#fff;border:1px solid #d1d5db;border-radius:8px;cursor:pointer;}"),
            (document.head || document.documentElement).appendChild(e));
        }
      })(),
      !document.getElementById(l))
    ) {
      var e = document.createElement("style");
      ((e.id = l),
        (e.textContent =
          "[data-admin-passage-modify]{background-color:#FFA25F!important;color:#fff!important;border-color:#FFA25F!important;}[data-admin-passage-delete]{background-color:#D94F3D!important;color:#fff!important;border-color:#D94F3D!important;}"),
        (document.head || document.documentElement).appendChild(e));
    }
  }
  function O() {
    return c.container
      ? c.container
      : document.querySelector("[data-admin-passage-library-list]") ||
          document.querySelector("[data-passage-library-list]");
  }
  function M() {
    if (c.container && c.template) return c;
    var e = O(),
      t = (function () {
        if (c.template) return c.template;
        var e =
          document.querySelector("[data-admin-passage-card-template]") ||
          document.querySelector("[data-passage-card-template]");
        if (e) return e;
        var t = O();
        return t
          ? t.querySelector("[data-admin-passage-card]") ||
              t.querySelector("[data-passage-card]")
          : null;
      })();
    return e && t
      ? (t.hasAttribute("data-admin-passage-card-template") ||
          t.setAttribute("data-admin-passage-card-template", ""),
        (t.style.display = "none"),
        t.setAttribute("aria-hidden", "true"),
        (c.container = e),
        (c.template = t),
        c)
      : null;
  }
  function j(e, t, a) {
    var n = e.querySelectorAll("[" + t + "]");
    0 === n.length && e.matches && e.matches("[" + t + "]")
      ? (e.textContent = String(a))
      : n.forEach(function (e) {
          e.textContent = String(a);
        });
  }
  function R(e, t) {
    var a, n, i, r, o, s, d, l;
    (e.setAttribute("data-admin-passage-id", t.id),
      e.setAttribute("data-passage-id", t.id),
      e.setAttribute("data-admin-passage-card", ""),
      e.setAttribute("data-passage-card", ""),
      j(e, "data-passage-title", t.title || "Untitled passage"),
      j(
        e,
        "data-passage-questions",
        ((a = t.questions_count),
        (n = Number(a || 0)) + " Question" + (1 === n ? "" : "s")),
      ),
      j(
        e,
        "data-passage-time",
        ((i = t.estimated_minutes), "~" + Math.max(1, Number(i || 1)) + " min"),
      ),
      j(e, "data-passage-category", t.category_label || t.section || ""),
      j(e, "data-passage-argument", t.argument_label || ""),
      j(e, "data-passage-cohesion", t.cohesion_label || ""),
      j(
        e,
        "data-passage-difficulty",
        null == (r = t.difficulty) || "" === r
          ? "Difficulty —"
          : "Difficulty " + r,
      ),
      (o = e),
      (s = "[data-passage-difficulty]"),
      (d = (function (e) {
        var t = Number(e);
        return Number.isFinite(t)
          ? t <= 3
            ? { color: "#1C1C1C", backgroundColor: "#eee" }
            : t <= 6
              ? { color: "#C8940A", backgroundColor: "#FDF3D0" }
              : t <= 8
                ? { color: "#FFA25F", backgroundColor: "#FFF0E3" }
                : { color: "#D94F3D", backgroundColor: "#FAE0DE" }
          : { color: "#1C1C1C", backgroundColor: "#eee" };
      })(t.difficulty)),
      0 === (l = o.querySelectorAll(s)).length &&
        o.matches &&
        o.matches(s) &&
        (l = [o]),
      l.forEach(function (e) {
        ((e.style.color = d.color),
          (e.style.backgroundColor = d.backgroundColor));
      }),
      e.querySelectorAll("[data-admin-passage-modify]").forEach(function (e) {
        e.setAttribute("data-passage-id", t.id);
      }),
      e.querySelectorAll("[data-admin-passage-delete]").forEach(function (e) {
        e.setAttribute("data-passage-id", t.id);
      }));
  }
  function J(e, t) {
    (e.addEventListener("click", function (e) {
      var a,
        n = e.target;
      n &&
        n.closest &&
        (n.closest("[data-admin-passage-modify]") ||
          n.closest("[data-admin-passage-delete]") ||
          (window.location.href =
            ((a = t.id),
            "https://www.premedcatalyst.com/portal-admin-questions?passage_id=" +
              encodeURIComponent(String(a)))));
    }),
      e.querySelectorAll("[data-admin-passage-modify]").forEach(function (e) {
        e.addEventListener("click", function (e) {
          var a;
          (e.preventDefault(),
            e.stopPropagation(),
            (a = t.id),
            ue(),
            (_.passageId = a),
            F("Loading passage..."),
            I(i, L({ action: "get", passage_id: a }))
              .then(function (e) {
                var t = e.passage || {};
                _.passage = {
                  passage_code: t.passage_code || "",
                  title: t.title || "",
                  body: t.body || "",
                  domain: t.domain || "",
                  subdomain: t.subdomain || "",
                  argument_mode: t.argument_mode || "",
                  cohesion: t.cohesion || "",
                  difficulty: null != t.difficulty ? t.difficulty : 5,
                  section: t.section || "CARS",
                  source_attribution: t.source_attribution || "",
                  is_active: !1 !== t.is_active,
                };
                var a = Array.isArray(e.questions) ? e.questions : [];
                ((_.questions = a.length
                  ? a.map(function (e, t) {
                      return {
                        id: e.id,
                        question_order: e.question_order || t + 1,
                        question_type: e.question_type || "inference",
                        stem: e.stem || "",
                        choices: Y(e.choices),
                        correct_choice: e.correct_choice || "A",
                        explanation_correct: e.explanation_correct || "",
                        explanation_a: e.explanation_a || "",
                        explanation_b: e.explanation_b || "",
                        explanation_c: e.explanation_c || "",
                        explanation_d: e.explanation_d || "",
                      };
                    })
                  : [ce(1)]),
                  (_.figures = Array.isArray(e.figures)
                    ? e.figures.map(function (e, t) {
                        return Se({
                          id: e.id,
                          figure_number: e.figure_number || t + 1,
                          panel_label: e.panel_label || "",
                          sort_order: e.sort_order || t + 1,
                          image_url: e.image_url || "",
                          caption: e.caption || "",
                          alt_text: e.alt_text || "",
                        });
                      })
                    : []),
                  _e("Edit passage"));
              })
              .catch(function (e) {
                window.alert(e.message || "Could not load passage");
              })
              .finally(N));
        });
      }),
      e.querySelectorAll("[data-admin-passage-delete]").forEach(function (e) {
        e.addEventListener("click", function (e) {
          (e.preventDefault(),
            e.stopPropagation(),
            (function (e) {
              var t = e.title || "this passage";
              if (!window.confirm('Delete "' + t + '"? This cannot be undone.'))
                return;
              (F("Deleting passage..."),
                I(n, L({ passage_id: e.id }))
                  .then(function () {
                    return (
                      F("Refreshing library..."),
                      Promise.all([Q(), V(0, !1)])
                    );
                  })
                  .catch(function (e) {
                    window.alert(e.message || "Delete failed");
                  })
                  .finally(N));
            })(t));
        });
      }));
  }
  function H() {
    return (
      document.querySelector("[data-admin-passage-library-load-more]") ||
      document.querySelector("[data-passage-library-load-more]") ||
      Array.from(document.querySelectorAll("button,a")).find(function (e) {
        return /load\s*more\s*passages/i.test((e.textContent || "").trim());
      }) ||
      null
    );
  }
  function G() {
    if (g) return g;
    var e = H();
    return (g = (e && (e.textContent || "").trim()) || "Load More Passages");
  }
  function U() {
    var e = H();
    e &&
      ((e.style.display = p ? "" : "none"),
      (e.disabled = m),
      e.setAttribute("aria-busy", m ? "true" : "false"),
      (e.textContent = y ? "Loading ..." : G()));
  }
  function Q() {
    return w()
      ? I(t, L()).then(function (e) {
          (B(
            "[data-admin-passage-library-summary]",
            (function (e) {
              return (
                Number(e.passages_available || e.passages_published || 0) +
                " passages available for students"
              );
            })(e),
          ),
            B("[data-passages-available]", Number(e.passages_available || 0)));
        })
      : (B(
          "[data-admin-passage-library-summary]",
          "Sign in as an admin to manage passages.",
        ),
        Promise.resolve());
  }
  function V(e, t) {
    return m
      ? Promise.resolve()
      : ((m = !0),
        (y = Boolean(t)),
        U(),
        I(
          a,
          L({
            limit: 8,
            offset: Number(e || 0),
            filters: {
              search: ie() ? String(ie().value || "").trim() : "",
              difficulty: re(te() ? te().value : ""),
              publication_status: oe(ae() ? ae().value : ""),
              passage_type: String(ne() ? ne().value : "").trim(),
            },
          }),
        )
          .then(function (a) {
            Array.isArray(a.passage_type_groups) &&
              ee((v = a.passage_type_groups));
            var n = Array.isArray(a.items) ? a.items : [],
              i = a.pagination || {};
            (!(function (e, t) {
              var a = M();
              if (a && Array.isArray(e)) {
                var n = a.container,
                  i = a.template;
                t ||
                  (function (e, t) {
                    e &&
                      e
                        .querySelectorAll(
                          "[data-admin-passage-card],[data-passage-card]",
                        )
                        .forEach(function (e) {
                          e !== t &&
                            (e.hasAttribute(
                              "data-admin-passage-card-template",
                            ) ||
                              e.hasAttribute("data-passage-card-template") ||
                              e.remove());
                        });
                  })(n, i);
                var r = document.createDocumentFragment();
                e.forEach(function (e) {
                  var t = i.cloneNode(!0);
                  (t.removeAttribute("data-admin-passage-card-template"),
                    t.removeAttribute("data-passage-card-template"),
                    t.removeAttribute("aria-hidden"),
                    (t.style.display = ""),
                    R(t, e),
                    J(t, e),
                    r.appendChild(t));
                });
                var o = H();
                o && o.parentElement === n
                  ? n.insertBefore(r, o)
                  : n.appendChild(r);
              }
            })(n, t),
              (function (e) {
                var t =
                  document.querySelector(
                    "[data-admin-passage-library-empty]",
                  ) || document.querySelector("[data-passage-library-empty]");
                if (!t) return;
                var a = Number((e && e.total) || 0);
                t.style.display = 0 === a ? "" : "none";
              })(i),
              (u =
                null != i.next_offset
                  ? Number(i.next_offset)
                  : Number(e || 0) + n.length),
              (p = Boolean(i.has_more)),
              U());
          })
          .finally(function () {
            ((m = !1), (y = !1), U());
          }));
  }
  function X() {
    return (
      document.querySelector("[data-admin-passage-library-filters]") ||
      document.querySelector("[data-passage-library-filters]")
    );
  }
  function Z(e) {
    var t = "[data-passage-filter-" + e + "]",
      a = X();
    if (a) {
      var n = a.querySelector(t);
      if (n) return n;
    }
    return document.querySelector(t);
  }
  function K(e, t) {
    var a = document.createElement("select");
    return (
      (a.className = "select"),
      a.setAttribute("data-passage-filter-" + e, ""),
      t && a.setAttribute("aria-label", t),
      a
    );
  }
  function W(e, t, a) {
    var n = document.createElement("option");
    ((n.value = t), (n.textContent = a), e.appendChild(n));
  }
  function Y(e) {
    var t = e;
    if ("string" == typeof t)
      try {
        t = JSON.parse(t);
      } catch (e) {
        t = {};
      }
    function a(e) {
      var a = t[e],
        n = t[String(e).toLowerCase()],
        i = null != a ? a : n;
      return null == i ? "" : String(i);
    }
    return (
      (t && "object" == typeof t) || (t = {}),
      { A: a("A"), B: a("B"), C: a("C"), D: a("D") }
    );
  }
  function $(e) {
    var t = String(e || "").trim();
    return t
      ? t
          .replace(/[-_]+/g, " ")
          .replace(/\s+/g, " ")
          .replace(/\b\w/g, function (e) {
            return e.toUpperCase();
          })
      : "";
  }
  function ee(e) {
    var t = (function () {
      var e = ne();
      if (e) return e;
      var t = X();
      if (!t) return null;
      var a = K("passage-type", "Passage type");
      W(a, "", "All Passage Types");
      var n = ae();
      return (
        n && n.nextSibling
          ? t.insertBefore(a, n.nextSibling)
          : n
            ? n.insertAdjacentElement("afterend", a)
            : t.appendChild(a),
        a
      );
    })();
    if (t && Array.isArray(e)) {
      var a = String(t.value || "");
      if (
        ((t.innerHTML = ""),
        W(t, "", "All Passage Types"),
        e.forEach(function (e) {
          if (e && e.domain && Array.isArray(e.subdomains)) {
            var a = e.subdomains
              .filter(function (e) {
                return String(e || "").trim();
              })
              .map(function (e) {
                var t = String(e).trim();
                return { value: t, label: $(t) || t };
              });
            0 !== a.length &&
              (function (e, t, a) {
                var n = document.createElement("optgroup");
                ((n.label = t),
                  a.forEach(function (e) {
                    W(n, e.value, e.label);
                  }),
                  e.appendChild(n));
              })(t, String(e.domain), a);
          }
        }),
        a)
      )
        Array.from(t.options).some(function (e) {
          return e.value === a;
        }) && (t.value = a);
    }
  }
  function te() {
    return Z("difficulty");
  }
  function ae() {
    return Z("publication");
  }
  function ne() {
    return Z("passage-type");
  }
  function ie() {
    var e = Z("search");
    return (
      e ||
      document.querySelector("input[data-passage-filter-search]") ||
      document.querySelector('input[placeholder*="Search passages"]') ||
      null
    );
  }
  function re(e) {
    var t = String(e || "").toLowerCase();
    return t && 0 !== t.indexOf("all difficulty")
      ? -1 !== t.indexOf("easy")
        ? "easy"
        : -1 !== t.indexOf("medium")
          ? "medium"
          : -1 !== t.indexOf("hard")
            ? "hard"
            : "all"
      : "all";
  }
  function oe(e) {
    var t = String(e || "").trim();
    return t && "All Publications" !== t
      ? /published/i.test(t)
        ? "published"
        : /draft/i.test(t)
          ? "draft"
          : "all"
      : "all";
  }
  function se() {
    return ((u = 0), (p = !1), F("Updating passages..."), V(0, !1).finally(N));
  }
  function de() {
    (b && clearTimeout(b),
      (b = setTimeout(function () {
        ((b = null),
          se().catch(function (e) {
            console.error("Admin passage filter error:", e);
          }));
      }, 300)));
  }
  function le() {
    if (
      ((function () {
        var e = X();
        if (e && !e.querySelector("[data-passage-filter-difficulty]")) {
          var t = K("difficulty", "Difficulty");
          (W(t, "All Difficulty Levels", "All Difficulty Levels"),
            W(t, "Easy (1–3)", "Easy (1–3)"),
            W(t, "Medium (4–6)", "Medium (4–6)"),
            W(t, "Hard (7–10)", "Hard (7–10)"));
          var a = K("publication", "Publication");
          (W(a, "All Publications", "All Publications"),
            W(a, "Published", "Published"),
            W(a, "Draft", "Draft"));
          var n = K("passage-type", "Passage type");
          (W(n, "", "All Passage Types"),
            e.appendChild(t),
            e.appendChild(a),
            e.appendChild(n),
            v && ee(v));
        }
      })(),
      !h)
    ) {
      h = !0;
      var e = ie();
      (e &&
        (e.addEventListener("input", de),
        e.addEventListener("keydown", function (e) {
          "Enter" === e.key &&
            (e.preventDefault(),
            b && clearTimeout(b),
            se().catch(console.error));
        })),
        [te(), ae(), ne()].forEach(function (e) {
          e &&
            e.addEventListener("change", function () {
              se().catch(console.error);
            });
        }));
      var t = (function () {
        var e = Z("clear");
        if (e) return e;
        var t = X() || document;
        return (
          Array.from(t.querySelectorAll("button,a")).find(function (e) {
            return /clear\s*filters/i.test((e.textContent || "").trim());
          }) || null
        );
      })();
      t &&
        t.addEventListener("click", function (e) {
          (e.preventDefault(),
            (function () {
              var e = ie();
              (e && (e.value = ""),
                [te(), ae(), ne()].forEach(function (e) {
                  e &&
                    e.options &&
                    e.options.length > 0 &&
                    (e.selectedIndex = 0);
                }));
            })(),
            se().catch(console.error));
        });
    }
  }
  function ce(e) {
    return {
      question_order: e,
      question_type: "inference",
      stem: "",
      choices: { A: "", B: "", C: "", D: "" },
      correct_choice: "A",
      explanation_correct: "",
      explanation_a: "",
      explanation_b: "",
      explanation_c: "",
      explanation_d: "",
    };
  }
  function Se(e) {
    return {
      id: e.id || void 0,
      figure_number: Number(e.figure_number) > 0 ? Number(e.figure_number) : 1,
      panel_label: String(e.panel_label || "")
        .trim()
        .toUpperCase(),
      sort_order: Number(e.sort_order) > 0 ? Number(e.sort_order) : 1,
      image_url: String(e.image_url || "").trim(),
      caption: String(e.caption || "").trim(),
      alt_text: String(e.alt_text || "").trim(),
      _pendingFile: e._pendingFile || null,
    };
  }
  function qe(e) {
    var t = Number(e) > 0 ? Number(e) : 1;
    return {
      figure_number: t,
      panel_label: 1 === t ? "1A" : "",
      sort_order: t,
      image_url: "",
      caption: "",
      alt_text: "",
    };
  }
  function ke(e, t) {
    var a = String(e || "CARS").trim().toUpperCase();
    return ("BB" === a ? "bb" : a.toLowerCase() || "cars") + "/" + De(t) + "/";
  }
  function De(e) {
    var t = String(e || "passage")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return t.slice(0, 64) || "passage";
  }
  function Be(e) {
    if (!e) return;
    e.querySelectorAll("[data-wizard-figure]").forEach(function (e, t) {
      function a(t) {
        var a = e.querySelector('[name="' + t + '"]');
        return a ? a.value : "";
      }
      var n = _.figures[t] || qe(t + 1),
        i = e.querySelector("[data-figure-file]");
      _.figures[t] = Se({
        id: e.getAttribute("data-figure-id") || n.id,
        figure_number: Number(a("figure_number")) || n.figure_number || t + 1,
        panel_label: a("panel_label").trim() || n.panel_label,
        sort_order: Number(a("sort_order")) || t + 1,
        image_url: n.image_url || "",
        caption: a("caption").trim() || n.caption,
        alt_text: a("alt_text").trim() || n.alt_text,
        _pendingFile:
          i && i.files && i.files[0] ? i.files[0] : n._pendingFile || null,
      });
    });
  }
  function Ie(e) {
    var t = fe("div", "admin-passage-figures-block full-width");
    t.setAttribute("data-wizard-figures-section", "");
    var a = fe("h3", "admin-passage-figures-title", "Figures (optional)");
    t.appendChild(a);
    var n = fe(
      "p",
      "admin-passage-figures-hint",
      "Images upload to Supabase storage under passage-figures/{section}/{passage-folder}/. Reference panels in the passage body as (Figure 1A).",
    );
    t.appendChild(n);
    var i = fe("p", "admin-passage-figures-path");
    function r() {
      var t = e.querySelector('[name="section"]'),
        a = e.querySelector('[name="passage_code"]');
      i.textContent =
        "Storage folder: passage-figures/" +
        ke(t ? t.value : "CARS", a ? a.value : "");
    }
    (r(),
      t.appendChild(i),
      e.querySelector('[name="section"]') &&
        e.querySelector('[name="section"]').addEventListener("input", r),
      e.querySelector('[name="passage_code"]') &&
        e.querySelector('[name="passage_code"]').addEventListener("input", r));
    var o = fe("div", "admin-passage-figures-list");
    (t.appendChild(o),
      (_.figures && _.figures.length) || (_.figures = []),
      _.figures.forEach(function (a, n) {
        o.appendChild(Le(a, n, o, e));
      }));
    var s = fe(
      "button",
      "admin-passage-wizard-btn secondary",
      "+ Add figure",
    );
    return (
      (s.type = "button"),
      s.addEventListener("click", function () {
        (Be(e),
          _.figures.push(qe(_.figures.length + 1)));
        var a = e.querySelector("[data-wizard-figures-section]");
        a && a.replaceWith(Ie(e));
      }),
      t.appendChild(s),
      t
    );
  }
  function Le(fig, t, a, gridEl) {
    var i = fe("div", "admin-passage-figure-row");
    (i.setAttribute("data-wizard-figure", ""),
      fig.id && i.setAttribute("data-figure-id", fig.id));
    function r(t, a, n) {
      var i = document.createElement("input");
      return (
        (i.name = t),
        (i.value = null != a ? String(a) : ""),
        n && (i.type = n),
        i
      );
    }
    i.appendChild(
      ge(
        "Figure #",
        r("figure_number", fig.figure_number || t + 1, "number"),
      ),
    );
    i.appendChild(
      ge("Panel (1A, 2B…)", r("panel_label", fig.panel_label || "")),
    );
    i.appendChild(
      ge("Sort order", r("sort_order", fig.sort_order || t + 1, "number")),
    );
    var o = document.createElement("textarea");
    ((o.name = "caption"),
      (o.value = fig.caption || ""),
      (o.rows = 3),
      i.appendChild(ge("Caption *", o)));
    var s = r("alt_text", fig.alt_text || "");
    i.appendChild(ge("Alt text", s));
    var d = document.createElement("input");
    d.type = "file";
    d.setAttribute("data-figure-file", "");
    d.accept = "image/svg+xml,image/png,image/jpeg,image/webp,image/gif";
    i.appendChild(ge("Image file", d));
    if (fig.image_url) {
      var l = fe("div", "admin-passage-figure-preview");
      ((l.innerHTML =
        '<img src="' +
        fig.image_url.replace(/"/g, "&quot;") +
        '" alt="" style="max-width:220px;max-height:140px;display:block;margin-top:8px;border:1px solid #e5e7eb;border-radius:6px;" />'),
        i.appendChild(l));
    }
    if (fig._pendingFile) {
      var c = fe(
        "p",
        "admin-passage-figures-pending",
        "Pending upload: " + fig._pendingFile.name,
      );
      i.appendChild(c);
    }
    var u = fe("button", "admin-passage-wizard-btn secondary", "Remove");
    return (
      (u.type = "button"),
      u.addEventListener("click", function () {
        (Be(gridEl), _.figures.splice(t, 1));
        var n = gridEl.querySelector("[data-wizard-figures-section]");
        n && n.replaceWith(Ie(gridEl));
      }),
      i.appendChild(u),
      i
    );
  }
  function ze() {
    var e = _.passage || {},
      t = String(e.passage_code || "").trim();
    if (!t) throw new Error("Passage code is required before uploading figures.");
    var a = [];
    return (
      _.figures.forEach(function (n, i) {
        if (n._pendingFile) {
          var o = new FormData();
          (o.append("file", n._pendingFile),
            o.append("admin_user_id", w() || ""),
            o.append("passage_code", t),
            o.append("section", e.section || "CARS"),
            o.append("panel_label", n.panel_label || ""),
            o.append(
              "figure_number",
              String(n.figure_number || i + 1),
            ),
            a.push(
              fetch(Ue, {
                method: "POST",
                headers: { apikey: r, Authorization: "Bearer " + r },
                body: o,
              })
                .then(function (e) {
                  return e.json().then(function (t) {
                    if (!e.ok)
                      throw new Error(
                        (t && (t.error || t.details)) || "Figure upload failed",
                      );
                    return t;
                  });
                })
                .then(function (e) {
                  ((_.figures[i].image_url = e.image_url),
                    delete _.figures[i]._pendingFile);
                }),
            ));
        }
      }),
      Promise.all(a)
    );
  }
  function Fe() {
    var e = _.figures
      .filter(function (e) {
        return (
          (e.panel_label || e.caption || e.image_url || e._pendingFile) &&
          e.panel_label &&
          e.caption &&
          e.image_url
        );
      })
      .map(function (e) {
        return {
          id: e.id,
          figure_number: e.figure_number,
          panel_label: e.panel_label,
          sort_order: e.sort_order,
          image_url: e.image_url,
          caption: e.caption,
          alt_text: e.alt_text || null,
        };
      });
    return I(
      i,
      L({ action: "save_figures", passage_id: _.passageId, figures: e }),
    );
  }
  function ue() {
    _ = {
      open: !1,
      step: 1,
      passageId: null,
      passage: {
        passage_code: "",
        title: "",
        body: "",
        domain: "",
        subdomain: "",
        argument_mode: "",
        cohesion: "",
        difficulty: 5,
        section: "CARS",
        source_attribution: "",
        is_active: !0,
      },
      questions: [ce(1)],
      figures: [],
    };
  }
  function pe() {
    return document.getElementById("admin-passage-wizard-backdrop");
  }
  function me() {
    var e = pe();
    (e && e.remove(), ue());
  }
  function fe(e, t, a) {
    var n = document.createElement(e);
    return (t && (n.className = t), null != a && (n.textContent = a), n);
  }
  function ge(e, t) {
    var a = fe("div", "admin-passage-field full-width"),
      n = fe("label", "", e);
    return (a.appendChild(n), a.appendChild(t), a);
  }
  function ye(e) {
    var a = _.passage || {};
    function t(t) {
      var a = e.querySelector('[name="' + t + '"]');
      return a ? a.value : "";
    }
    if (!e.querySelector('[name="passage_code"]')) return;
    _.passage = {
      passage_code: t("passage_code").trim(),
      title: t("title").trim(),
      body: t("body").trim(),
      domain: t("domain").trim(),
      subdomain: t("subdomain").trim(),
      argument_mode: t("argument_mode").trim(),
      cohesion: t("cohesion").trim(),
      difficulty: Number(t("difficulty")) || a.difficulty || 5,
      section: t("section").trim() || "CARS",
      source_attribution: t("source_attribution").trim(),
      is_active: Boolean(
        e.querySelector('[name="is_active"]') &&
        e.querySelector('[name="is_active"]').checked,
      ),
    };
    e.querySelector("[data-wizard-figures-section]") && Be(e);
  }
  function he(e) {
    var t = e.querySelectorAll("[data-wizard-question]"),
      a = [];
    if (!t.length) return;
    (t.forEach(function (e, t) {
      function n(t) {
        var a = e.querySelector('[name="' + t + '"]');
        return a ? a.value : "";
      }
      var i = n("question_type").trim(),
        r = n("question_type_custom").trim() || ("__custom__" === i ? "" : i),
        o = _.questions[t] || {},
        s = n("correct_choice").trim().toUpperCase();
      a.push({
        id: e.getAttribute("data-question-id") || void 0,
        question_order: t + 1,
        question_type: r || "inference",
        stem: n("stem").trim() || o.stem || "",
        choices: {
          A: n("choice_a").trim() || (o.choices && o.choices.A) || "",
          B: n("choice_b").trim() || (o.choices && o.choices.B) || "",
          C: n("choice_c").trim() || (o.choices && o.choices.C) || "",
          D: n("choice_d").trim() || (o.choices && o.choices.D) || "",
        },
        correct_choice: s || o.correct_choice || "A",
        explanation_correct:
          n("explanation_correct").trim() || o.explanation_correct || "",
        explanation_a: n("explanation_a").trim() || o.explanation_a || "",
        explanation_b: n("explanation_b").trim() || o.explanation_b || "",
        explanation_c: n("explanation_c").trim() || o.explanation_c || "",
        explanation_d: n("explanation_d").trim() || o.explanation_d || "",
      });
    }),
      (_.questions = a.length ? a : [ce(1)]));
  }
  function be(e) {
    ((e.innerHTML = ""),
      1 === _.step
        ? (function (e) {
            var t = fe("div", "admin-passage-wizard-grid"),
              a = _.passage;
            function n(e, t, a) {
              var n = document.createElement("input");
              return (
                (n.name = e),
                (n.value = null != t ? String(t) : ""),
                a && (n.type = a),
                n
              );
            }
            (t.appendChild(
              ge("Passage code *", n("passage_code", a.passage_code)),
            ),
              t.appendChild(ge("Title *", n("title", a.title))));
            var i = document.createElement("textarea");
            ((i.name = "body"),
              (i.value = a.body || ""),
              t.appendChild(ge("Passage body *", i)),
              t.appendChild(ge("Domain", n("domain", a.domain))),
              t.appendChild(
                ge("Subdomain / topic", n("subdomain", a.subdomain)),
              ),
              t.appendChild(
                ge("Argument mode", n("argument_mode", a.argument_mode)),
              ),
              t.appendChild(ge("Cohesion", n("cohesion", a.cohesion))),
              t.appendChild(
                ge(
                  "Difficulty (1–10)",
                  n("difficulty", a.difficulty, "number"),
                ),
              ),
              t.appendChild(ge("Section", n("section", a.section || "CARS"))));
            var r = document.createElement("textarea");
            ((r.name = "source_attribution"),
              (r.value = a.source_attribution || ""),
              (r.rows = 3),
              t.appendChild(ge("Source attribution", r)));
            var o = document.createElement("input");
            ((o.type = "checkbox"),
              (o.name = "is_active"),
              (o.checked = !1 !== a.is_active));
            var s = fe("div", "admin-passage-field full-width");
            (s.appendChild(o),
              s.appendChild(
                document.createTextNode(" Publish to students (is_active)"),
              ),
              t.appendChild(s),
              t.appendChild(Ie(t)),
              e.appendChild(t));
          })(e)
        : 2 === _.step
          ? (function (e) {
              _.questions.forEach(function (t, a) {
                e.appendChild(ve(t, a, 2, e));
              });
              var t = fe(
                "button",
                "admin-passage-wizard-btn secondary",
                "+ Add question",
              );
              ((t.type = "button"),
                t.addEventListener("click", function () {
                  (_.questions.push(ce(_.questions.length + 1)), be(e));
                }),
                e.appendChild(t));
            })(e)
          : (function (e) {
              _.questions.forEach(function (t, a) {
                e.appendChild(ve(t, a, 3, e));
              });
            })(e));
  }
  function ve(e, t, a, n) {
    var i = fe("div", "admin-passage-question-block");
    (i.setAttribute("data-wizard-question", ""),
      e.id && i.setAttribute("data-question-id", e.id),
      i.appendChild(fe("h3", "", "Question " + (t + 1))));
    var r = document.createElement("div"),
      o = (function (e) {
        var t = document.createElement("select");
        ((t.name = "question_type"),
          x.forEach(function (e) {
            W(t, e.value, e.label);
          }),
          W(t, "__custom__", "Custom..."));
        var a = (e || "").trim(),
          n = x.map(function (e) {
            return e.value;
          });
        return (
          a && n.indexOf(a) >= 0
            ? (t.value = a)
            : (t.value = a ? "__custom__" : "inference"),
          t
        );
      })(e.question_type),
      s = document.createElement("input");
    function d() {
      s.style.display = "__custom__" === o.value ? "" : "none";
    }
    ((s.name = "question_type_custom"),
      (s.placeholder = "Enter custom question type"),
      (s.style.marginTop = "8px"),
      (s.value = "__custom__" === o.value ? String(e.question_type || "") : ""),
      o.addEventListener("change", d),
      d(),
      r.appendChild(o),
      r.appendChild(s),
      i.appendChild(ge("Question type", r)));
    var l = document.createElement("textarea");
    if (
      ((l.name = "stem"),
      (l.value = e.stem || ""),
      (l.rows = 3),
      i.appendChild(ge("Stem *", l)),
      ["A", "B", "C", "D"].forEach(function (t) {
        var a = document.createElement("input");
        ((a.name = "choice_" + t.toLowerCase()),
          (a.value = (e.choices && e.choices[t]) || ""),
          i.appendChild(ge("Choice " + t + " *", a)));
      }),
      a >= 3)
    ) {
      var c = document.createElement("select");
      function u(e, t, a) {
        var n = document.createElement("textarea");
        ((n.name = e),
          (n.value = a || ""),
          (n.rows = 2),
          i.appendChild(ge(t, n)));
      }
      ((c.name = "correct_choice"),
        ["A", "B", "C", "D"].forEach(function (e) {
          W(c, e, "Correct: " + e);
        }),
        (c.value = e.correct_choice || "A"),
        i.appendChild(ge("Correct answer *", c)),
        u(
          "explanation_correct",
          "Explanation (why correct)",
          e.explanation_correct,
        ),
        u("explanation_a", "Explanation A", e.explanation_a),
        u("explanation_b", "Explanation B", e.explanation_b),
        u("explanation_c", "Explanation C", e.explanation_c),
        u("explanation_d", "Explanation D", e.explanation_d));
    }
    if (2 === a && _.questions.length > 1) {
      var p = fe("button", "admin-passage-wizard-btn secondary", "Remove");
      ((p.type = "button"),
        p.addEventListener("click", function () {
          (_.questions.splice(t, 1), n && be(n));
        }),
        i.appendChild(p));
    }
    return i;
  }
  function _e(e) {
    (!(function () {
      var e = pe();
      e && e.remove();
    })(),
      (_.open = !0));
    var t = fe("div", "admin-passage-wizard-backdrop");
    t.id = "admin-passage-wizard-backdrop";
    var a = fe("div", "admin-passage-wizard"),
      n = fe("div", "admin-passage-wizard-header");
    n.appendChild(fe("h2", "", e));
    var r = fe("button", "admin-passage-wizard-close", "×");
    ((r.type = "button"),
      r.addEventListener("click", me),
      n.appendChild(r),
      a.appendChild(n));
    var o = fe("div", "admin-passage-wizard-steps");
    ([1, 2, 3].forEach(function (e) {
      var t = fe(
        "span",
        "admin-passage-wizard-step-pill",
        "Step " +
          e +
          (1 === e ? ": Passage" : 2 === e ? ": Questions" : ": Answers"),
      );
      (t.setAttribute("data-step", String(e)), o.appendChild(t));
    }),
      a.appendChild(o));
    var s = fe("div", "admin-passage-wizard-body");
    a.appendChild(s);
    var d = fe("div", "admin-passage-wizard-footer"),
      l = fe("button", "admin-passage-wizard-btn secondary", "Back");
    l.type = "button";
    var c = fe("button", "admin-passage-wizard-btn primary", "Next");
    c.type = "button";
    var u = fe("button", "admin-passage-wizard-btn secondary", "Cancel");
    ((u.type = "button"), u.addEventListener("click", me));
    var p = fe("div", "right");
    function m() {
      (!(function (e) {
        e.querySelectorAll(".admin-passage-wizard-step-pill").forEach(
          function (e) {
            var t = Number(e.getAttribute("data-step"));
            e.classList.toggle("is-active", t === _.step);
          },
        );
      })(a),
        (l.style.visibility = 1 === _.step ? "hidden" : "visible"),
        (c.textContent = 3 === _.step ? "Save" : "Continue"),
        be(s));
    }
    (p.appendChild(u),
      p.appendChild(c),
      d.appendChild(l),
      d.appendChild(p),
      a.appendChild(d),
      t.appendChild(a),
      document.body.appendChild(t),
      window.AdminWizardSteps &&
        window.AdminWizardSteps.wireStepPills({
          modal: a,
          mode: "passage",
          maxStep: 3,
          getStep: function () {
            return _.step;
          },
          setStep: function (s) {
            _.step = s;
          },
          getData: function () {
            return { passage: _.passage, questions: _.questions };
          },
          readCurrentStep: function (mod) {
            1 === _.step ? ye(mod) : he(mod);
          },
          refreshNav: m,
        }),
      l.addEventListener("click", function () {
        (1 === _.step ? ye(a) : he(a),
          _.step > 1 &&
            (window.AdminWizardSteps
              ? window.AdminWizardSteps.goToStep({
                  modal: a,
                  mode: "passage",
                  maxStep: 3,
                  targetStep: _.step - 1,
                  getStep: function () {
                    return _.step;
                  },
                  setStep: function (s) {
                    _.step = s;
                  },
                  getData: function () {
                    return { passage: _.passage, questions: _.questions };
                  },
                  readCurrentStep: function (mod) {
                    1 === _.step ? ye(mod) : he(mod);
                  },
                  refreshNav: m,
                })
              : ((_.step -= 1), m())));
      }),
      c.addEventListener("click", function () {
        if ((1 === _.step ? ye(a) : he(a), _.step < 3)) {
          if (1 === _.step) {
            var W = window.AdminWizardSteps;
            if (W) {
              var R = W.validatePassageStep1(_.passage);
              if (R.length) return void W.showNotification(a, R);
              W.hideNotification(a);
            }
            ((c.disabled = !0),
              (c.textContent = "Saving..."),
              F("Saving passage..."),
              I(
                i,
                L({
                  action: "save_step1",
                  passage_id: _.passageId,
                  passage: _.passage,
                }),
              )
                .then(function (e) {
                  _.passageId = e.passage_id;
                  return ze();
                })
                .then(function () {
                  return Fe();
                })
                .then(function () {
                  _.step += 1;
                  m();
                })
                .catch(function (e) {
                  window.alert(e.message || "Save failed");
                })
                .finally(function () {
                  (N(), (c.disabled = !1), (c.textContent = "Continue"));
                }));
            return;
          }
          if (2 === _.step) {
            var P = window.AdminWizardSteps;
            if (P) {
              var Q = P.validatePassageStep2(_.questions);
              if (Q.length) return void P.showNotification(a, Q);
              P.hideNotification(a);
            }
          }
          _.step += 1;
          m();
          return;
        }
        var e = c.textContent;
        he(a);
        var X = window.AdminWizardSteps;
        if (X) {
          var Y = X.validatePassageStep3(_.questions);
          if (Y.length) return void X.showNotification(a, Y);
          X.hideNotification(a);
        }
        ((c.disabled = !0),
          (c.textContent = "Saving..."),
          F("Saving passage..."));
        var t = I(
          i,
          L({
            action: "save_step1",
            passage_id: _.passageId,
            passage: _.passage,
          }),
        )
          .then(function (e) {
            _.passageId = e.passage_id;
            return ze();
          })
          .then(function () {
            return Fe();
          })
          .then(function () {
            return I(
              i,
              L({
                action: "save_step2",
                passage_id: _.passageId,
                questions: _.questions,
              }),
            );
          })
          .then(function (e) {
            Array.isArray(e.questions) &&
              (_.questions = e.questions.map(function (e, t) {
                return {
                  id: e.id,
                  question_order: e.question_order || t + 1,
                  question_type: e.question_type,
                  stem: e.stem,
                  choices: e.choices || {},
                  correct_choice: e.correct_choice || "A",
                  explanation_correct: e.explanation_correct || "",
                  explanation_a: e.explanation_a || "",
                  explanation_b: e.explanation_b || "",
                  explanation_c: e.explanation_c || "",
                  explanation_d: e.explanation_d || "",
                };
              }));
            return I(
              i,
              L({
                action: "save_step3",
                passage_id: _.passageId,
                questions: _.questions,
              }),
            );
          })
          .then(function () {
            return me(), F("Refreshing library..."), Promise.all([Q(), V(0, !1)]);
          });
          t
            .catch(function (e) {
              window.alert(e.message || "Save failed");
            })
            .finally(function () {
              (N(), (c.disabled = !1), (c.textContent = e));
            });
      }),
      m());
  }
  function xe() {
    var e =
      document.querySelector("[data-admin-add-passage]") ||
      Array.from(document.querySelectorAll("button,a")).find(function (e) {
        return /add\s*new\s*passage/i.test((e.textContent || "").trim());
      });
    e &&
      e.addEventListener("click", function (e) {
        (e.preventDefault(), ue(), _e("Add new passage"));
      });
  }
  function Ce() {
    D() ||
      (T(),
      le(),
      (function () {
        if (!f) {
          var e = H();
          e &&
            (G(),
            (f = !0),
            e.addEventListener("click", function (e) {
              (e.preventDefault(),
                p &&
                  !m &&
                  V(u, !0).catch(function (e) {
                    console.error("Admin passage library load-more:", e);
                  }));
            }));
        }
      })(),
      xe(),
      ue(),
      F("Loading passage library..."),
      Promise.all([Q(), V(0, !1)])
        .catch(function (e) {
          (console.error("Admin passage library init error:", e),
            B(
              "[data-admin-passage-library-summary]",
              "Could not load passages. Check console and edge function deploy.",
            ));
        })
        .finally(N));
  }
  async function Ae() {
    (z(),
      F("Loading passage library..."),
      A(),
      (function () {
        if (!document.getElementById("sidebar-admin-link")) {
          var e = document.createElement("a");
          ((e.id = "sidebar-admin-link"),
            (e.className = "sidebar-admin-link"),
            (e.href = "/portal-admin"),
            (e.innerHTML =
              '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg><span class="sidebar-text sidebar-admin-link-text">Admin Dashboard</span>'));
          var t = document.querySelector(".sidebar-nav");
          if (t) t.appendChild(e);
          else {
            var a = document.querySelector(".sidebar");
            a && a.appendChild(e);
          }
        }
      })(),
      (await (k ||
        (k = (async function () {
          var e = w();
          if (!e || !E()) return (window.location.replace(S), !1);
          try {
            var t = await fetch(q, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: r,
                  Authorization: "Bearer " + r,
                },
                body: JSON.stringify({ user_id: e }),
              }),
              a = await t.json().catch(function () {
                return {};
              });
            if (t.ok && a && !0 === a.is_admin) return !0;
          } catch (e) {}
          return (window.location.replace(S), !1);
        })()))) && Ce());
  }
  (z(),
    "loading" === document.readyState
      ? document.addEventListener("DOMContentLoaded", Ae)
      : Ae());
})();
