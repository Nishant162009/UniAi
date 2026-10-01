/* ==========================================================================
   UniAI — SOP & LOR Studio
   --------------------------------------------------------------------------
   This file is intentionally separate from main script.js.

   It supports the SOP Studio HTML with:
   - SOP Writer
   - LOR Writer
   - Document Evaluator
   - Dynamic experience/example cards
   - Word counters
   - Progress tracking
   - Editable generated drafts
   - Revision / re-evaluation flow
   - Local fallback generation when no AI endpoint is available

   main script.js can keep all other application features.
   ========================================================================== */

"use strict";

(() => {
  /* ------------------------------------------------------------------------
     00. CONFIG + HELPERS
     ------------------------------------------------------------------------ */

  const SOP_CONFIG = {
    // Optional backend endpoint. If your backend implements it, set:
    // POST /ai/sop  -> { text: "..." }
    // POST /ai/lor  -> { text: "..." }
    //
    // Leave empty to use the local structured draft generator.
    SOP_AI_ENDPOINT: "",
    LOR_AI_ENDPOINT: "",

    STORAGE_KEY: "uniai-sop-studio"
  };

  const $ = (id) => document.getElementById(id);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const valueOf = (id) => {
    const el = $(id);
    return el ? String(el.value || "").trim() : "";
  };

  const escapeHTML = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const stripHTML = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent || div.innerText || "";
  };

  const wordCount = (text) =>
    String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean).length;

  const sentenceCount = (text) =>
    (String(text || "").match(/[.!?]+(?=\s|$)/g) || []).length;

  const hasNumber = (text) => /\b\d+(?:\.\d+)?%?\b/.test(text);

  const show = (el) => {
    if (el) el.classList.remove("hidden");
  };

  const hide = (el) => {
    if (el) el.classList.add("hidden");
  };

  const scrollToElement = (el) => {
    if (!el) return;

    el.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  function setButtonLoading(
    button,
    loading,
    label,
    loadingLabel = "Working…"
  ) {
    if (!button) return;

    button.disabled = loading;

    const text = button.querySelector(".btn-text");

    if (text) {
      text.textContent = loading ? loadingLabel : label;
    } else {
      button.textContent = loading ? loadingLabel : label;
    }

    button.classList.toggle("is-loading", loading);
  }


  /* ------------------------------------------------------------------------
     01. PERSISTENCE
     ------------------------------------------------------------------------ */

  function saveStudioState() {
    try {
      const data = {
        sop: {
          name: valueOf("sop-name"),
          program: valueOf("sop-program"),
          university: valueOf("sop-university"),
          intake: valueOf("sop-intake"),
          motivation: valueOf("sop-motivation"),
          shortGoal: valueOf("sop-short-term-goal"),
          longGoal: valueOf("sop-long-term-goal")
        },

        lor: {
          recommenderName: valueOf("lor-recommender-name"),
          recommenderRole: valueOf("lor-recommender-role"),
          institution: valueOf("lor-institution"),
          relationship: valueOf("lor-relationship"),
          studentName: valueOf("lor-student-name"),
          program: valueOf("lor-program"),
          university: valueOf("lor-university"),
          strengths: valueOf("lor-strengths"),
          comparison: valueOf("lor-comparison")
        }
      };

      localStorage.setItem(
        SOP_CONFIG.STORAGE_KEY,
        JSON.stringify(data)
      );
    } catch (err) {
      console.warn(
        "SOP Studio: could not save draft state.",
        err
      );
    }
  }

  function restoreStudioState() {
    try {
      const raw = localStorage.getItem(
        SOP_CONFIG.STORAGE_KEY
      );

      if (!raw) return;

      const data = JSON.parse(raw);

      const set = (id, value) => {
        const el = $(id);

        if (el && value != null) {
          el.value = value;
        }
      };

      set("sop-name", data.sop?.name);
      set("sop-program", data.sop?.program);
      set("sop-university", data.sop?.university);
      set("sop-intake", data.sop?.intake);
      set("sop-motivation", data.sop?.motivation);
      set(
        "sop-short-term-goal",
        data.sop?.shortGoal
      );
      set(
        "sop-long-term-goal",
        data.sop?.longGoal
      );

      set(
        "lor-recommender-name",
        data.lor?.recommenderName
      );
      set(
        "lor-recommender-role",
        data.lor?.recommenderRole
      );
      set(
        "lor-institution",
        data.lor?.institution
      );
      set(
        "lor-relationship",
        data.lor?.relationship
      );
      set(
        "lor-student-name",
        data.lor?.studentName
      );
      set(
        "lor-program",
        data.lor?.program
      );
      set(
        "lor-university",
        data.lor?.university
      );
      set(
        "lor-strengths",
        data.lor?.strengths
      );
      set(
        "lor-comparison",
        data.lor?.comparison
      );
    } catch (err) {
      console.warn(
        "SOP Studio: could not restore state.",
        err
      );
    }
  }


  /* ------------------------------------------------------------------------
     02. TABS
     ------------------------------------------------------------------------ */

  function switchSopTab(tabName) {
    const tabs = {
      sopWriter: $("sopWriterTab"),
      lorWriter: $("lorWriterTab"),
      evaluator: $("evaluatorTab")
    };

    Object.entries(tabs).forEach(
      ([name, panel]) => {
        if (panel) {
          panel.classList.toggle(
            "hidden",
            name !== tabName
          );
        }
      }
    );

    $$(".sop-tab-btn").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.tab === tabName ||
          button
            .getAttribute("onclick")
            ?.includes(`'${tabName}'`)
      );
    });

    updateSopProgress();

    const page = $("sopStudioPage");

    if (page) {
      page.dataset.activeTool = tabName;
    }
  }


  /* ------------------------------------------------------------------------
     03. SOP EXPERIENCE CARDS
     ------------------------------------------------------------------------ */

  function addExperienceEntry(initial = {}) {
    const container = $("experienceContainer");

    if (!container) return;

    const entry = document.createElement("div");

    entry.className =
      "dynamic-entry experience-entry";

    entry.innerHTML = `
      <div class="dynamic-entry-header">
        <span class="dynamic-entry-number">
          Experience
        </span>

        <button
          type="button"
          class="btn-remove"
          aria-label="Remove experience">
          ×
        </button>
      </div>

      <div class="sop-fields">

        <div class="form-group">
          <label>Experience type</label>

          <select class="exp-type">
            ${[
              "Project",
              "Internship",
              "Work Experience",
              "Research",
              "Coursework",
              "Certification",
              "Publication",
              "Competition",
              "Extracurricular",
              "Volunteering"
            ]
              .map(
                (type) =>
                  `<option value="${escapeHTML(type)}" ${
                    initial.type === type
                      ? "selected"
                      : ""
                  }>
                    ${escapeHTML(type)}
                  </option>`
              )
              .join("")}
          </select>
        </div>

        <div class="form-group">
          <label>Title / role</label>

          <input
            type="text"
            class="exp-title"
            value="${escapeHTML(
              initial.title || ""
            )}"
            placeholder="e.g. Computer Vision Intern">
        </div>

        <div class="form-group">
          <label>What did you actually do?</label>

          <textarea
            class="exp-desc"
            rows="3"
            placeholder="Describe your contribution, methods, tools, or responsibilities...">${escapeHTML(
              initial.description || ""
            )}</textarea>
        </div>

        <div class="form-group">
          <label>What was the result?</label>

          <textarea
            class="exp-result"
            rows="2"
            placeholder="Add a measurable result, outcome, finding, or lesson...">${escapeHTML(
              initial.result || ""
            )}</textarea>
        </div>

      </div>
    `;

    const removeButton =
      entry.querySelector(".btn-remove");

    removeButton.addEventListener(
      "click",
      () => {
        entry.remove();

        updateExperienceEmptyState();
        updateSopProgress();
        saveStudioState();
      }
    );

    container.appendChild(entry);

    updateExperienceEmptyState();
    updateSopProgress();
    saveStudioState();

    return entry;
  }

  function removeEntry(button) {
    if (!button) return;

    const entry =
      button.closest(".dynamic-entry");

    if (entry) {
      entry.remove();
    }

    updateExperienceEmptyState();
    updateSopProgress();
    saveStudioState();
  }

  function updateExperienceEmptyState() {
    const container =
      $("experienceContainer");

    const empty =
      $("experienceEmptyState");

    if (!container || !empty) return;

    const hasEntries =
      container.querySelector(
        ".dynamic-entry"
      );

    empty.classList.toggle(
      "hidden",
      Boolean(hasEntries)
    );
  }

  function collectExperiences() {
    return $$("#experienceContainer .experience-entry")
      .map((entry) => ({
        type:
          entry
            .querySelector(".exp-type")
            ?.value.trim() ||
          "Experience",

        title:
          entry
            .querySelector(".exp-title")
            ?.value.trim() ||
          "",

        description:
          entry
            .querySelector(".exp-desc")
            ?.value.trim() ||
          "",

        result:
          entry
            .querySelector(".exp-result")
            ?.value.trim() ||
          ""
      }))
      .filter(
        (item) =>
          item.title ||
          item.description ||
          item.result
      );
  }


  /* ------------------------------------------------------------------------
     04. SOP PROGRESS
     ------------------------------------------------------------------------ */

  function updateSopProgress() {
    const fields = [
      "sop-name",
      "sop-program",
      "sop-university",
      "sop-motivation",
      "sop-short-term-goal",
      "sop-long-term-goal"
    ];

    const filled = fields.filter(
      (id) => valueOf(id)
    ).length;

    const experienceCount =
      collectExperiences().length;

    const total = fields.length + 2;

    const completed =
      filled +
      Math.min(experienceCount, 2);

    const percent = Math.round(
      (completed / total) * 100
    );

    const fill = $("sopProgressFill");

    if (fill) {
      fill.style.width =
        `${Math.min(percent, 100)}%`;
    }

    const text = document.querySelector(
      ".sop-progress .progress-text"
    );

    if (text) {
      text.textContent =
        percent >= 90
          ? "Ready to draft"
          : percent >= 55
          ? "Good progress"
          : "Profile";
    }
  }


  /* ------------------------------------------------------------------------
     05. SOP DRAFT GENERATION
     ------------------------------------------------------------------------ */

  function buildSOPDraft() {
    const name =
      valueOf("sop-name") ||
      "the applicant";

    const program =
      valueOf("sop-program") ||
      "the intended graduate program";

    const university =
      valueOf("sop-university") ||
      "the target university";

    const intake =
      valueOf("sop-intake");

    const motivation =
      valueOf("sop-motivation");

    const shortGoal =
      valueOf("sop-short-term-goal");

    const longGoal =
      valueOf("sop-long-term-goal");

    const experiences =
      collectExperiences();

    const experienceParagraphs =
      experiences.length
        ? experiences
            .map((item) => {
              const result = item.result
                ? ` The outcome was ${item.result}`
                : "";

              return `
                <p>
                  During my ${escapeHTML(
                    item.type.toLowerCase()
                  )} experience as
                  <strong>
                    ${escapeHTML(item.title)}
                  </strong>, I
                  ${escapeHTML(
                    item.description ||
                      "worked on a problem that strengthened my understanding of the field."
                  )}
                  ${escapeHTML(result)}
                </p>
              `;
            })
            .join("")
        : `
            <p>
              My academic and professional experiences
              have gradually helped me identify the
              problems I want to explore at graduate level.
              <strong>
                [Add a specific experience here.]
              </strong>
            </p>
          `;

    const motivationParagraph =
      motivation
        ? `<p>${escapeHTML(
            motivation
          )}</p>`
        : `
            <p>
              My interest in this field developed through
              a series of academic and practical
              experiences rather than from a single
              abstract ambition. <strong>
              [Add the specific moment or experience
              that started this interest.]
              </strong>
            </p>
          `;

    const shortGoalParagraph =
      shortGoal
        ? `<p>${escapeHTML(
            shortGoal
          )}</p>`
        : `
            <p>
              At ${escapeHTML(program)}, I hope to
              strengthen my technical foundation and
              develop the ability to approach complex
              problems through deeper study and
              practical work.
            </p>
          `;

    const longGoalParagraph =
      longGoal
        ? `<p>${escapeHTML(
            longGoal
          )}</p>`
        : `
            <p>
              In the longer term, I hope to apply this
              training to meaningful problems in my field
              and contribute through technically grounded
              work.
            </p>
          `;

    return `
      <p>
        <strong>Statement of Purpose</strong>
      </p>

      <p>
        I am ${escapeHTML(name)}, applying to the
        ${escapeHTML(program)} at
        ${escapeHTML(university)}${
          intake
            ? ` for the ${escapeHTML(
                intake
              )} intake`
            : ""
        }.
      </p>

      ${motivationParagraph}

      ${experienceParagraphs}

      <p>
        These experiences have shaped the questions
        I now want to explore through graduate study.
        They also showed me the limits of what I could
        learn independently and the value of a structured
        academic environment.
      </p>

      <p>
        I am particularly interested in
        ${escapeHTML(program)} because I want to connect
        my previous experience with more advanced study.
        <strong>
          [Add one or two specific courses, faculty
          members, laboratories, research groups, or
          resources at ${escapeHTML(university)}.]
        </strong>
      </p>

      ${shortGoalParagraph}

      ${longGoalParagraph}

      <p>
        I would bring to the program the perspective
        developed through my previous academic and
        practical experiences, together with a willingness
        to learn from peers and contribute to collaborative
        work.
      </p>

      <p>
        Thank you for considering my application.
      </p>

      <hr>

      <p>
        <em>
          Drafting note: replace every bracketed
          instruction with evidence from your own
          experience. The goal is a truthful, specific
          document, not generic admissions language.
        </em>
      </p>
    `;
  }

  async function generateSOP() {
    const output =
      $("generatedSopContainer");

    const editor =
      $("sopTextEditor");

    const button =
      document.querySelector(
        '#sopWriterTab .btn-ai-generate[onclick*="generateSOP"]'
      );

    if (!editor || !output) return;

    setButtonLoading(
      button,
      true,
      "Generate SOP",
      "Building draft…"
    );

    try {
      saveStudioState();

      let html = "";

      if (SOP_CONFIG.SOP_AI_ENDPOINT) {
        html = await requestAI(
          SOP_CONFIG.SOP_AI_ENDPOINT,
          collectSOPPayload()
        );
      }

      editor.innerHTML =
        html || buildSOPDraft();

      show(output);

      updateWordCount(
        editor,
        $("sopWordCount")
      );

      scrollToElement(output);
    } catch (err) {
      console.error(
        "SOP generation failed:",
        err
      );

      editor.innerHTML =
        buildSOPDraft();

      show(output);

      updateWordCount(
        editor,
        $("sopWordCount")
      );
    } finally {
      setButtonLoading(
        button,
        false,
        "Generate SOP"
      );
    }
  }

  function regenerateSOP() {
    generateSOP();
  }


  /* ------------------------------------------------------------------------
     06. LOR EXAMPLE CARDS
     ------------------------------------------------------------------------ */

  function addLORExample(initial = {}) {
    const container =
      $("lorExamplesContainer");

    if (!container) return;

    const entry =
      document.createElement("div");

    entry.className =
      "dynamic-entry lor-example-entry";

    entry.innerHTML = `
      <div class="dynamic-entry-header">

        <span class="dynamic-entry-number">
          Example
        </span>

        <button
          type="button"
          class="btn-remove"
          aria-label="Remove example">
          ×
        </button>

      </div>

      <div class="sop-fields">

        <div class="form-group">
          <label>Context</label>

          <input
            type="text"
            class="lor-example-context"
            value="${escapeHTML(
              initial.context || ""
            )}"
            placeholder="e.g. Machine Learning course project">
        </div>

        <div class="form-group">
          <label>
            What did the applicant do?
          </label>

          <textarea
            class="lor-example-action"
            rows="3"
            placeholder="Describe the applicant's specific contribution...">${escapeHTML(
              initial.action || ""
            )}</textarea>
        </div>

        <div class="form-group">
          <label>
            What did you observe?
          </label>

          <textarea
            class="lor-example-observation"
            rows="3"
            placeholder="What did this reveal about the applicant's ability or character?">${escapeHTML(
              initial.observation || ""
            )}</textarea>
        </div>

        <div class="form-group">
          <label>
            Outcome / evidence
          </label>

          <textarea
            class="lor-example-outcome"
            rows="2"
            placeholder="Result, achievement, feedback, ranking, improvement, or other evidence...">${escapeHTML(
              initial.outcome || ""
            )}</textarea>
        </div>

      </div>
    `;

    entry
      .querySelector(".btn-remove")
      .addEventListener(
        "click",
        () => {
          entry.remove();
          saveStudioState();
        }
      );

    container.appendChild(entry);

    saveStudioState();

    return entry;
  }

  function collectLORExamples() {
    return $$("#lorExamplesContainer .lor-example-entry")
      .map((entry) => ({
        context:
          entry
            .querySelector(
              ".lor-example-context"
            )
            ?.value.trim() || "",

        action:
          entry
            .querySelector(
              ".lor-example-action"
            )
            ?.value.trim() || "",

        observation:
          entry
            .querySelector(
              ".lor-example-observation"
            )
            ?.value.trim() || "",

        outcome:
          entry
            .querySelector(
              ".lor-example-outcome"
            )
            ?.value.trim() || ""
      }))
      .filter(
        (item) =>
          item.context ||
          item.action ||
          item.observation ||
          item.outcome
      );
  }


  /* ------------------------------------------------------------------------
     07. LOR DRAFT GENERATION
     ------------------------------------------------------------------------ */

  function buildLORDraft() {
    const recommender =
      valueOf("lor-recommender-name") ||
      "the recommender";

    const role =
      valueOf("lor-recommender-role") ||
      "a faculty member";

    const institution =
      valueOf("lor-institution") ||
      "the institution";

    const relationship =
      valueOf("lor-relationship") ||
      "the applicant's academic work";

    const student =
      valueOf("lor-student-name") ||
      "the applicant";

    const program =
      valueOf("lor-program") ||
      "the intended graduate program";

    const university =
      valueOf("lor-university") ||
      "the target university";

    const strengths =
      valueOf("lor-strengths");

    const comparison =
      valueOf("lor-comparison");

    const examples =
      collectLORExamples();

    const evidenceParagraphs =
      examples.length
        ? examples
            .map(
              (example) => `
                <p>
                  In ${escapeHTML(
                    example.context ||
                      "one of the applicant's experiences"
                  )},
                  ${escapeHTML(
                    example.action ||
                      "the applicant demonstrated a clear ability to contribute."
                  )}
                  ${escapeHTML(
                    example.observation ||
                      "This allowed me to observe the applicant's approach to the work."
                  )}
                  ${
                    example.outcome
                      ? escapeHTML(
                          ` ${example.outcome}`
                        )
                      : ""
                  }
                </p>
              `
            )
            .join("")
        : `
            <p>
              I have observed ${escapeHTML(
                student
              )} in academic and practical settings and
              have seen evidence of strong initiative and
              engagement.
              <strong>
                [Add a specific example here.]
              </strong>
            </p>
          `;

    return `
      <p>
        <strong>
          Letter of Recommendation
        </strong>
      </p>

      <p>
        To the Admissions Committee,
      </p>

      <p>
        I am ${escapeHTML(
          recommender
        )}, ${escapeHTML(
          role
        )} at ${escapeHTML(
          institution
        )}. I have known
        ${escapeHTML(
          student
        )} through ${escapeHTML(
          relationship
        )}, which has given me the opportunity to
        observe the applicant's academic development
        and approach to challenging work.
      </p>

      <p>
        I am pleased to recommend
        ${escapeHTML(
          student
        )} for admission to the
        ${escapeHTML(
          program
        )} at ${escapeHTML(
          university
        )}.
      </p>

      ${evidenceParagraphs}

      ${
        strengths
          ? `<p>${escapeHTML(
              strengths
            )}</p>`
          : `
              <p>
                Across these experiences,
                ${escapeHTML(
                  student
                )} has demonstrated qualities such as
                initiative, analytical thinking,
                persistence, and the ability to work
                constructively with others.
              </p>
            `
      }

      ${
        comparison
          ? `<p>${escapeHTML(
              comparison
            )}</p>`
          : `
              <p>
                <strong>
                  [If you can make a truthful comparison
                  with other students you have taught or
                  supervised, include it here with
                  appropriate context.]
                </strong>
              </p>
            `
      }

      <p>
        Based on my experience with
        ${escapeHTML(
          student
        )}, I believe the applicant has the preparation
        and motivation to engage seriously with
        graduate-level study. I expect the applicant
        to approach the program with curiosity,
        discipline, and a willingness to contribute
        to the academic community.
      </p>

      <p>
        I am happy to recommend
        ${escapeHTML(
          student
        )} for consideration by your program.
      </p>

      <p>
        Sincerely,<br>
        ${escapeHTML(
          recommender
        )}<br>
        ${escapeHTML(
          role
        )}<br>
        ${escapeHTML(
          institution
        )}
      </p>

      <hr>

      <p>
        <em>
          Drafting note: replace general praise with
          observations that the recommender can genuinely
          support. Do not invent achievements, rankings,
          comparisons, or personal experiences.
        </em>
      </p>
    `;
  }

  async function generateLOR() {
    const output =
      $("generatedLorContainer");

    const editor =
      $("lorTextEditor");

    const button =
      document.querySelector(
        '#lorWriterTab .btn-ai-generate[onclick*="generateLOR"]'
      );

    if (!editor || !output) return;

    setButtonLoading(
      button,
      true,
      "Generate LOR",
      "Building letter…"
    );

    try {
      saveStudioState();

      let html = "";

      if (SOP_CONFIG.LOR_AI_ENDPOINT) {
        html = await requestAI(
          SOP_CONFIG.LOR_AI_ENDPOINT,
          collectLORPayload()
        );
      }

      editor.innerHTML =
        html || buildLORDraft();

      show(output);

      updateWordCount(
        editor,
        $("lorWordCount")
      );

      scrollToElement(output);
    } catch (err) {
      console.error(
        "LOR generation failed:",
        err
      );

      editor.innerHTML =
        buildLORDraft();

      show(output);

      updateWordCount(
        editor,
        $("lorWordCount")
      );
    } finally {
      setButtonLoading(
        button,
        false,
        "Generate LOR"
      );
    }
  }

  function regenerateLOR() {
    generateLOR();
  }


  /* ------------------------------------------------------------------------
     08. EVALUATOR
     ------------------------------------------------------------------------ */

  function getEvaluationText() {
    const input =
      $("sop-eval-input");

    return input
      ? input.value.trim()
      : "";
  }

  function calculateEvaluation(
    text,
    type,
    program,
    university
  ) {
    const lower =
      text.toLowerCase();

    const words =
      wordCount(text);

    const sentences =
      sentenceCount(text);

    const criteria = [];

    /* Specificity */

    let specificity = 45;

    if (hasNumber(text)) {
      specificity += 15;
    }

    if (
      /\b(project|internship|research|thesis|publication|experiment)\b/i.test(
        text
      )
    ) {
      specificity += 12;
    }

    if (sentences >= 8) {
      specificity += 8;
    }

    criteria.push({
      key: "specificity",

      label:
        "Specificity & evidence",

      score:
        Math.min(
          95,
          specificity
        ),

      feedback:
        specificity >= 75
          ? "The document contains concrete experiences or evidence. Check that each example explains the applicant's own contribution."
          : "Several claims would be stronger with a specific project, responsibility, result, observation, or measurable outcome."
    });


    /* Structure */

    let structure = 55;

    if (sentences >= 6) {
      structure += 8;
    }

    if (
      lower.includes("however") ||
      lower.includes("therefore")
    ) {
      structure += 5;
    }

    if (
      lower.includes("goal") ||
      lower.includes("future")
    ) {
      structure += 8;
    }

    if (
      lower.includes("experience") ||
      lower.includes("project")
    ) {
      structure += 7;
    }

    criteria.push({
      key: "structure",

      label:
        "Structure & progression",

      score:
        Math.min(
          95,
          structure
        ),

      feedback:
        structure >= 75
          ? "There is a visible progression between experience, motivation, and future direction."
          : "The draft would benefit from a clearer sequence: background → evidence → motivation → program connection → goals."
    });


    /* Program fit */

    let fit = 40;

    if (
      program &&
      lower.includes(
        program.toLowerCase()
      )
    ) {
      fit += 20;
    }

    if (
      university &&
      lower.includes(
        university.toLowerCase()
      )
    ) {
      fit += 15;
    }

    if (
      /\b(course|faculty|professor|lab|research group|curriculum)\b/i.test(
        text
      )
    ) {
      fit += 15;
    }

    criteria.push({
      key: "fit",

      label:
        "Program alignment",

      score:
        Math.min(
          95,
          fit
        ),

      feedback:
        fit >= 75
          ? "The document makes a recognizable connection to the target program."
          : "Add specific program resources and explain why they matter to the applicant's academic direction."
    });


    /* Voice */

    let voice = 62;

    const firstPerson =
      (
        text.match(
          /\bI\b/g
        ) || []
      ).length;

    if (firstPerson >= 3) {
      voice += 10;
    }

    const genericPhrases = [
      "always been passionate",
      "dream university",
      "since childhood",
      "make a difference",
      "cutting-edge",
      "world-class"
    ];

    const genericCount =
      genericPhrases.filter(
        (phrase) =>
          lower.includes(phrase)
      ).length;

    voice += Math.max(
      0,
      15 -
        genericCount * 6
    );

    criteria.push({
      key: "voice",

      label:
        "Authenticity & voice",

      score:
        Math.min(
          95,
          voice
        ),

      feedback:
        genericCount
          ? "Some familiar admissions phrases appear. Replace them with language grounded in the applicant's actual experiences."
          : "The draft generally reads as applicant-focused. Keep the language natural and evidence-led."
    });


    /* Coherence */

    let coherence = 58;

    if (sentences >= 10) {
      coherence += 8;
    }

    if (
      /\bbecause|which|therefore|through|led me to|motivated me\b/i.test(
        text
      )
    ) {
      coherence += 10;
    }

    if (
      /\bgoal|interest|experience|program\b/i.test(
        text
      )
    ) {
      coherence += 10;
    }

    criteria.push({
      key: "coherence",

      label:
        "Narrative coherence",

      score:
        Math.min(
          95,
          coherence
        ),

      feedback:
        coherence >= 75
          ? "The document has enough connective language to show how experiences relate to future goals."
          : "Make the cause-and-effect relationships clearer: explain how each major experience changed what the applicant wanted to learn or do next."
    });


    /* Length */

    const lengthTarget =
      type === "lor"
        ? {
            min: 350,
            max: 900
          }
        : {
            min: 500,
            max: 1200
          };

    let lengthScore = 80;

    if (
      words <
      lengthTarget.min
    ) {
      lengthScore -= 20;
    }

    if (
      words >
      lengthTarget.max
    ) {
      lengthScore -= 10;
    }

    criteria.push({
      key: "length",

      label:
        "Length & density",

      score:
        Math.max(
          40,
          Math.min(
            95,
            lengthScore
          )
        ),

      feedback:
        words <
        lengthTarget.min
          ? `The draft is ${words} words. It may need more evidence and development for a document of this type.`
          : words >
            lengthTarget.max
          ? `The draft is ${words} words. Look for repetition and compress ideas that do not add new evidence.`
          : `The draft is ${words} words, which provides enough space to develop its main ideas without relying only on length.`
    });


    const overall =
      Math.round(
        criteria.reduce(
          (sum, item) =>
            sum + item.score,
          0
        ) /
          criteria.length
      );

    return {
      overall,
      words,
      sentences,
      criteria,

      summary:
        overall >= 80
          ? "The draft has a workable foundation. The next revision should focus on sharpening evidence and making the program connection more concrete."
          : overall >= 65
          ? "The draft has useful material, but several claims need stronger evidence and clearer connections between experience and future direction."
          : "The draft needs another evidence-focused revision. Start by replacing general claims with specific experiences, outcomes, and reasons for pursuing the target program."
    };
  }


  function evaluateSOP() {
    const results =
      $("evaluationResults");

    const text =
      getEvaluationText();

    if (!results) return;

    if (!text) {
      show(results);

      results.innerHTML = `
        <div class="evaluation-empty">

          <h3>
            Add your document first
          </h3>

          <p>
            Paste an SOP or LOR above so the evaluator
            can review its structure, evidence, voice,
            and program alignment.
          </p>

        </div>
      `;

      return;
    }

    const type =
      valueOf(
        "evaluationDocumentType"
      ) === "lor"
        ? "lor"
        : "sop";

    const evaluation =
      calculateEvaluation(
        text,
        type,
        valueOf(
          "evaluationProgram"
        ),
        valueOf(
          "evaluationUniversity"
        )
      );

    renderEvaluationResults(
      evaluation
    );

    results.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }


  function renderEvaluationResults(
    evaluation
  ) {
    const results =
      $("evaluationResults");

    if (!results) return;

    show(results);

    const score =
      $("evaluationOverallScore");

    const summary =
      $("evaluationSummary");

    const criteriaContainer =
      $("evaluationCriteria");

    const feedbackContainer =
      $("evaluationDetailedFeedback");

    if (score) {
      score.textContent =
        evaluation.overall;
    }

    if (summary) {
      summary.textContent =
        evaluation.summary;
    }

    if (criteriaContainer) {
      criteriaContainer.innerHTML =
        evaluation.criteria
          .map(
            (item) => `
              <div class="evaluation-criterion">

                <div
                  class="evaluation-criterion-header">

                  <span>
                    ${escapeHTML(
                      item.label
                    )}
                  </span>

                  <strong>
                    ${item.score}/100
                  </strong>

                </div>

                <div
                  class="evaluation-criterion-track">

                  <div
                    class="evaluation-criterion-fill"
                    style="width:${item.score}%">
                  </div>

                </div>

                <p>
                  ${escapeHTML(
                    item.feedback
                  )}
                </p>

              </div>
            `
          )
          .join("");
    }

    if (feedbackContainer) {
      const priority =
        [
          ...evaluation.criteria
        ]
          .sort(
            (a, b) =>
              a.score - b.score
          )
          .slice(0, 3);

      feedbackContainer.innerHTML = `
        <div class="feedback-priority-list">

          ${priority
            .map(
              (item, index) => `
                <div class="feedback-item">

                  <span
                    class="feedback-index">
                    0${index + 1}
                  </span>

                  <div>

                    <strong>
                      ${escapeHTML(
                        item.label
                      )}
                    </strong>

                    <p>
                      ${escapeHTML(
                        item.feedback
                      )}
                    </p>

                  </div>

                </div>
              `
            )
            .join("")}

        </div>

        <div
          class="evaluation-disclaimer">

          This is a writing-quality review,
          not an admissions decision or prediction.
          A human reviewer should make the final
          assessment.

        </div>
      `;
    }
  }


  function reevaluateDocument() {
    evaluateSOP();
  }


  function evaluateGeneratedSOP() {
    const editor =
      $("sopTextEditor");

    const input =
      $("sop-eval-input");

    if (!editor || !input) return;

    input.value =
      stripHTML(
        editor.innerHTML
      );

    const type =
      $("evaluationDocumentType");

    if (type) {
      type.value = "sop";
    }

    switchSopTab(
      "evaluator"
    );

    evaluateSOP();
  }


  function evaluateGeneratedLOR() {
    const editor =
      $("lorTextEditor");

    const input =
      $("sop-eval-input");

    if (!editor || !input) return;

    input.value =
      stripHTML(
        editor.innerHTML
      );

    const type =
      $("evaluationDocumentType");

    if (type) {
      type.value = "lor";
    }

    switchSopTab(
      "evaluator"
    );

    evaluateSOP();
  }


  function clearEvaluationText() {
    const input =
      $("sop-eval-input");

    const results =
      $("evaluationResults");

    if (input) {
      input.value = "";
    }

    if (results) {
      hide(results);
    }

    updateEvaluationWordCount();
  }


  /* ------------------------------------------------------------------------
     09. WORD COUNTERS
     ------------------------------------------------------------------------ */

  function updateWordCount(
    editor,
    target
  ) {
    if (!editor || !target) return;

    const text =
      stripHTML(
        editor.innerHTML
      );

    target.textContent =
      `${wordCount(text)} words`;
  }


  function updateEvaluationWordCount() {
    const target =
      $("evaluationWordCount");

    if (!target) return;

    target.textContent =
      `${wordCount(
        getEvaluationText()
      )} words`;
  }


  /* ------------------------------------------------------------------------
     10. OPTIONAL BACKEND AI REQUEST
     ------------------------------------------------------------------------ */

  async function requestAI(
    endpoint,
    payload
  ) {
    const response =
      await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );

    if (!response.ok) {
      throw new Error(
        `AI endpoint returned HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (
      typeof data.text ===
      "string"
    ) {
      return data.text;
    }

    if (
      typeof data.html ===
      "string"
    ) {
      return data.html;
    }

    throw new Error(
      "AI endpoint did not return text or html."
    );
  }


  function collectSOPPayload() {
    return {
      type: "sop",

      name:
        valueOf("sop-name"),

      program:
        valueOf("sop-program"),

      university:
        valueOf("sop-university"),

      intake:
        valueOf("sop-intake"),

      motivation:
        valueOf("sop-motivation"),

      experiences:
        collectExperiences(),

      shortTermGoal:
        valueOf(
          "sop-short-term-goal"
        ),

      longTermGoal:
        valueOf(
          "sop-long-term-goal"
        )
    };
  }


  function collectLORPayload() {
    return {
      type: "lor",

      recommender: {
        name:
          valueOf(
            "lor-recommender-name"
          ),

        role:
          valueOf(
            "lor-recommender-role"
          ),

        institution:
          valueOf(
            "lor-institution"
          ),

        relationship:
          valueOf(
            "lor-relationship"
          )
      },

      applicant: {
        name:
          valueOf(
            "lor-student-name"
          ),

        program:
          valueOf(
            "lor-program"
          ),

        university:
          valueOf(
            "lor-university"
          )
      },

      examples:
        collectLORExamples(),

      strengths:
        valueOf(
          "lor-strengths"
        ),

      comparison:
        valueOf(
          "lor-comparison"
        )
    };
  }


  /* ------------------------------------------------------------------------
     11. LIVE FORM BEHAVIOR
     ------------------------------------------------------------------------ */

  function setupLiveEvents() {
    document.addEventListener(
      "input",
      (event) => {
        const target =
          event.target;

        if (!target) return;

        if (
          target.closest(
            "#sopWriterTab"
          )
        ) {
          updateSopProgress();
          saveStudioState();
        }

        if (
          target.id ===
          "sop-eval-input"
        ) {
          updateEvaluationWordCount();
        }

        if (
          target.closest(
            "#sopTextEditor"
          )
        ) {
          updateWordCount(
            $("sopTextEditor"),
            $("sopWordCount")
          );
        }

        if (
          target.closest(
            "#lorTextEditor"
          )
        ) {
          updateWordCount(
            $("lorTextEditor"),
            $("lorWordCount")
          );
        }
      }
    );


    document.addEventListener(
      "change",
      (event) => {
        if (
          event.target.closest(
            "#sopWriterTab"
          ) ||
          event.target.closest(
            "#lorWriterTab"
          )
        ) {
          saveStudioState();
          updateSopProgress();
        }
      }
    );
  }


  /* ------------------------------------------------------------------------
     12. INITIALIZATION
     ------------------------------------------------------------------------ */

  function initSOPStudio() {
    restoreStudioState();

    updateExperienceEmptyState();

    updateSopProgress();

    updateEvaluationWordCount();

    /*
     * The SOP page is lazy-loaded by main
     * script.js. We therefore initialize from
     * delegated document events instead of
     * assuming the markup exists immediately.
     */

    setupLiveEvents();

    /*
     * If the markup already exists,
     * default to SOP Writer.
     */

    if (
      $("sopWriterTab") ||
      $("sopGeneratorTab")
    ) {
      switchSopTab(
        "sopWriter"
      );
    }

    console.log(
      "UniAI: SOP & LOR Studio initialized."
    );
  }


  /* ------------------------------------------------------------------------
     13. GLOBAL EXPORTS
     ------------------------------------------------------------------------ */

  Object.assign(window, {

    switchSopTab,

    addExperienceEntry,

    removeEntry,

    generateSOP,

    regenerateSOP,

    addLORExample,

    generateLOR,

    regenerateLOR,

    evaluateSOP,

    reevaluateDocument,

    evaluateGeneratedSOP,

    evaluateGeneratedLOR,

    clearEvaluationText

  });


  /*
   * main script.js lazy-loads sop.html after
   * the initial page load.
   *
   * Waiting for DOMContentLoaded lets both
   * setups coexist safely.
   */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initSOPStudio,
      {
        once: true
      }
    );
  } else {
    initSOPStudio();
  }

})();