document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     STUDY ABROAD GUIDE
     ========================================================= */

  const guidePage = document.querySelector("#studyAbroadGuidePage");

  if (!guidePage) return;


  /* =========================================================
     ELEMENTS
     ========================================================= */

  const hero = guidePage.querySelector(".guide-hero");

  const startButtons = guidePage.querySelectorAll(
    ".guide-primary-btn"
  );

  const progressSteps = guidePage.querySelectorAll(
    ".progress-step"
  );

  const stages = guidePage.querySelectorAll(
    ".guide-stage"
  );

  const checklist = guidePage.querySelector(
    ".fly-checklist"
  );

  const checklistItems = guidePage.querySelectorAll(
    ".fly-checklist input[type='checkbox']"
  );

  const progressCount = guidePage.querySelector(
    ".progress-count"
  );

  const checkProgress = guidePage.querySelector(
    ".check-progress"
  );


  /* =========================================================
     STAGE / PROGRESS MAPPING
     ========================================================= */

  const stageMap = Array.from(stages);

  const progressMap = Array.from(progressSteps);


  /* =========================================================
     SMOOTH SCROLL HELPER
     ========================================================= */

  function scrollToElement(element) {
    if (!element) return;

    const headerOffset = 80;

    const elementPosition =
      element.getBoundingClientRect().top +
      window.pageYOffset;

    const offsetPosition =
      elementPosition - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth"
    });
  }


  /* =========================================================
     START JOURNEY BUTTON
     ========================================================= */

  startButtons.forEach(button => {
    button.addEventListener("click", () => {

      if (stageMap.length > 0) {
        scrollToElement(stageMap[0]);
      }

    });
  });


  /* =========================================================
     PROGRESS STEP CLICK
     ========================================================= */

  progressSteps.forEach((step, index) => {

    step.style.cursor = "pointer";

    step.addEventListener("click", () => {

      const targetStage = stageMap[index];

      if (targetStage) {
        scrollToElement(targetStage);
      }

    });

  });


  /* =========================================================
     ACTIVE PROGRESS STEP
     ========================================================= */

  function updateProgressStep() {

    if (!stageMap.length) return;

    const scrollPosition =
      window.scrollY + window.innerHeight * 0.35;

    let activeIndex = 0;

    stageMap.forEach((stage, index) => {

      const stageTop =
        stage.offsetTop;

      if (scrollPosition >= stageTop) {
        activeIndex = index;
      }

    });


    progressMap.forEach((step, index) => {

      step.classList.toggle(
        "active",
        index === activeIndex
      );

    });

  }


  window.addEventListener(
    "scroll",
    updateProgressStep,
    { passive: true }
  );

  updateProgressStep();


  /* =========================================================
     CHECKLIST
     ========================================================= */

  function updateChecklist() {

    if (!checklistItems.length) return;

    const total = checklistItems.length;

    const completed =
      Array.from(checklistItems)
        .filter(item => item.checked)
        .length;


    /* Update text */

    if (checkProgress) {
      checkProgress.textContent =
        `${completed} / ${total} complete`;
    }


    /* Update individual labels */

    checklistItems.forEach(input => {

      const label = input.closest("label");

      if (!label) return;

      label.classList.toggle(
        "completed",
        input.checked
      );

    });


    /* Update progress percentage */

    const percentage =
      Math.round((completed / total) * 100);


    if (checklist) {

      checklist.style.setProperty(
        "--check-progress",
        `${percentage}%`
      );

    }


    /* All completed */

    if (
      completed === total &&
      total > 0
    ) {

      const beforeFly =
        guidePage.querySelector(".before-fly");

      if (beforeFly) {
        beforeFly.classList.add(
          "all-complete"
        );
      }

    } else {

      const beforeFly =
        guidePage.querySelector(".before-fly");

      if (beforeFly) {
        beforeFly.classList.remove(
          "all-complete"
        );
      }

    }

  }


  checklistItems.forEach(input => {

    input.addEventListener(
      "change",
      updateChecklist
    );

  });


  updateChecklist();


  /* =========================================================
     STAGE REVEAL ANIMATION
     ========================================================= */

  if ("IntersectionObserver" in window) {

    const stageObserver =
      new IntersectionObserver(
        entries => {

          entries.forEach(entry => {

            if (entry.isIntersecting) {

              entry.target.classList.add(
                "stage-visible"
              );

              stageObserver.unobserve(
                entry.target
              );

            }

          });

        },
        {
          threshold: 0.15
        }
      );


    stages.forEach(stage => {
      stageObserver.observe(stage);
    });

  } else {

    stages.forEach(stage => {
      stage.classList.add("stage-visible");
    });

  }


  /* =========================================================
     BUTTON ROUTING
     ========================================================= */

  const stageLinks =
    guidePage.querySelectorAll(
      ".stage-link"
    );


  stageLinks.forEach(button => {

    button.addEventListener("click", () => {

      const text =
        button.textContent
          .trim()
          .toLowerCase();


      /*
       * Connect these to your existing pages/functions.
       */

      if (text.includes("university finder")) {

        // Example:
        // showPage("universityFinderPage");

        console.log(
          "Opening University Finder..."
        );

      }


      if (text.includes("visa guide")) {

        // Example:
        // showPage("visaGuidePage");

        console.log(
          "Opening Visa Guide..."
        );

      }

    });

  });


  /* =========================================================
     TOOL BUTTONS
     ========================================================= */

  const toolButtons =
    guidePage.querySelectorAll(
      ".stage-tools button"
    );


  toolButtons.forEach(button => {

    button.addEventListener("click", () => {

      const text =
        button.textContent
          .trim()
          .toLowerCase();


      if (text.includes("cost calculator")) {

        console.log(
          "Opening Cost Calculator..."
        );

        // Example:
        // showPage("costCalculatorPage");

      }


      if (text.includes("currency converter")) {

        console.log(
          "Opening Currency Converter..."
        );

        // Example:
        // showPage("currencyConverterPage");

      }

    });

  });


  /* =========================================================
     APPLICATION TRACKER
     ========================================================= */

  const applicationStatus =
    guidePage.querySelector(
      ".application-status"
    );


  if (applicationStatus) {

    applicationStatus.style.cursor =
      "pointer";

    applicationStatus.addEventListener(
      "click",
      () => {

        /*
         * Connect this to your tracker page.
         */

        console.log(
          "Opening Application Tracker..."
        );

      }
    );

  }


  /* =========================================================
     KEYBOARD ACCESSIBILITY
     ========================================================= */

  progressSteps.forEach(step => {

    step.setAttribute(
      "tabindex",
      "0"
    );


    step.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {

          event.preventDefault();

          step.click();

        }

      }
    );

  });


  /* =========================================================
     SAVE CHECKLIST
     ========================================================= */

  const STORAGE_KEY =
    "studyAbroadChecklist";


  function saveChecklist() {

    const values =
      Array.from(checklistItems)
        .map(input => input.checked);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(values)
    );

  }


  function loadChecklist() {

    const saved =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!saved) return;

    try {

      const values =
        JSON.parse(saved);

      checklistItems.forEach(
        (input, index) => {

          if (
            typeof values[index] ===
            "boolean"
          ) {

            input.checked =
              values[index];

          }

        }
      );

    } catch (error) {

      console.warn(
        "Could not load checklist.",
        error
      );

    }

  }


  checklistItems.forEach(input => {

    input.addEventListener(
      "change",
      saveChecklist
    );

  });


  loadChecklist();
  updateChecklist();


  /* =========================================================
     HERO PARALLAX
     ========================================================= */

  const heroVisual =
    guidePage.querySelector(
      ".guide-hero-visual"
    );


  if (heroVisual && window.innerWidth > 768) {

    window.addEventListener(
      "scroll",
      () => {

        const scrollY =
          window.scrollY;

        if (scrollY > 700) return;

        heroVisual.style.transform =
          `translateY(${scrollY * 0.08}px)`;

      },
      { passive: true }
    );

  }


  /* =========================================================
     CURRENT STAGE LABEL
     ========================================================= */

  function updateStageNumbers() {

    stages.forEach((stage, index) => {

      stage.dataset.stage =
        index + 1;

    });

  }


  updateStageNumbers();


  /* =========================================================
     FINISHED
     ========================================================= */

  console.log(
    "Study Abroad Guide initialized successfully."
  );

});