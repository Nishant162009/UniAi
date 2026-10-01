document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     VISA GUIDE
  ========================================================= */

  const visaPage = document.getElementById("visaGuidePage");

  if (!visaPage) return;


  /* =========================================================
     ELEMENTS
  ========================================================= */

  const searchInput =
    visaPage.querySelector("#visaSearch");

  const clearSearchButton =
    visaPage.querySelector("#clearVisaSearch");

  const regionFilter =
    visaPage.querySelector("#visaRegionFilter");

  const visaTypeFilter =
    visaPage.querySelector("#visaTypeFilter");

  const resetButton =
    visaPage.querySelector("#visaResetFilters");

  const resultsText =
    visaPage.querySelector("#visaResultsText");

  const countryGrid =
    visaPage.querySelector("#visaCountryGrid");

  const loading =
    visaPage.querySelector("#visaLoading");

  const empty =
    visaPage.querySelector("#visaEmpty");

  const emptyReset =
    visaPage.querySelector("#visaEmptyReset");

  const modal =
    visaPage.querySelector("#visaDetailsModal");

  const modalBody =
    visaPage.querySelector("#visaModalBody");

  const modalClose =
    visaPage.querySelector("#visaModalClose");

  const countryCount =
    visaPage.querySelector("#visaCountryCount");


  /* =========================================================
     DATA
  ========================================================= */

  let visaData = [];


  /* =========================================================
     LOAD DATASET
  ========================================================= */

  async function loadVisaData() {

    showLoading();

    try {

      const response =
        await fetch("./data/visas.json");

      if (!response.ok) {
        throw new Error(
          `HTTP error: ${response.status}`
        );
      }

      visaData = await response.json();

      console.log(
        "Visa dataset loaded:",
        visaData
      );

      if (countryCount) {
        countryCount.textContent =
          visaData.length;
      }

      populateVisaTypeFilter();

      renderCountries(visaData);

    } catch (error) {

      console.error(
        "Failed to load visa dataset:",
        error
      );

      showError();

    } finally {

      hideLoading();

    }

  }


  /* =========================================================
     LOADING
  ========================================================= */

  function showLoading() {

    if (loading) {
      loading.classList.remove("hidden");
    }

    if (countryGrid) {
      countryGrid.innerHTML = "";
    }

    if (empty) {
      empty.classList.add("hidden");
    }

  }


  function hideLoading() {

    if (loading) {
      loading.classList.add("hidden");
    }

  }


  function showError() {

    if (resultsText) {
      resultsText.textContent =
        "Unable to load visa guides.";
    }

    if (empty) {
      empty.classList.remove("hidden");
    }

  }


  /* =========================================================
     VISA TYPE FILTER
  ========================================================= */

  function populateVisaTypeFilter() {

    if (!visaTypeFilter) return;

    const types = new Map();

    visaData.forEach(country => {

      if (!Array.isArray(country.visaTypes)) {
        return;
      }

      country.visaTypes.forEach(visa => {

        if (!types.has(visa.id)) {

          types.set(
            visa.id,
            visa.name
          );

        }

      });

    });


    visaTypeFilter.innerHTML = `
      <option value="all">
        All visa types
      </option>
    `;


    types.forEach((name, id) => {

      const option =
        document.createElement("option");

      option.value = id;
      option.textContent = name;

      visaTypeFilter.appendChild(option);

    });

  }


  /* =========================================================
     FILTER DATA
  ========================================================= */

  function getFilteredCountries() {

    const search =
      searchInput
        ? searchInput.value
            .trim()
            .toLowerCase()
        : "";

    const selectedRegion =
      regionFilter
        ? regionFilter.value
        : "all";

    const selectedVisaType =
      visaTypeFilter
        ? visaTypeFilter.value
        : "all";


    return visaData.filter(country => {

      /* Search */

      const matchesSearch =
        !search ||
        country.country
          .toLowerCase()
          .includes(search) ||
        country.countryCode
          .toLowerCase()
          .includes(search);


      /* Region */

      const matchesRegion =
        selectedRegion === "all" ||
        country.region === selectedRegion;


      /* Visa type */

      const matchesVisaType =
        selectedVisaType === "all" ||
        country.visaTypes.some(
          visa =>
            visa.id === selectedVisaType
        );


      return (
        matchesSearch &&
        matchesRegion &&
        matchesVisaType
      );

    });

  }


  /* =========================================================
     RENDER COUNTRIES
  ========================================================= */

  function renderCountries(countries) {

    if (!countryGrid) return;

    countryGrid.innerHTML = "";


    if (!countries.length) {

      showEmptyState();

      return;

    }


    hideEmptyState();


    countries.forEach(country => {

      const card =
        createCountryCard(country);

      countryGrid.appendChild(card);

    });


    updateResultsText(countries.length);

  }


  /* =========================================================
     COUNTRY CARD
  ========================================================= */

  function createCountryCard(country) {

    const card =
      document.createElement("article");

    card.className =
      "visa-country-card";


    const visaNames =
      country.visaTypes
        .map(visa => visa.name)
        .join(", ");


    card.innerHTML = `

      <div class="visa-country-card-top">

        <div class="visa-country-flag">
          ${country.flag || "🌎"}
        </div>

        <div class="visa-country-region">
          ${formatRegion(country.region)}
        </div>

      </div>


      <div class="visa-country-card-body">

        <h3>
          ${escapeHTML(country.country)}
        </h3>

        <p>
          ${escapeHTML(
            getCountryDescription(country)
          )}
        </p>


        <div class="visa-country-types">

          ${country.visaTypes
            .map(visa => `
              <span class="visa-type-tag">
                ${escapeHTML(visa.name)}
              </span>
            `)
            .join("")}

        </div>


        <button
          type="button"
          class="visa-country-button"
          data-country-id="${escapeHTML(country.id)}"
        >
          View visa guide
          <span>→</span>
        </button>

      </div>

    `;


    const button =
      card.querySelector(
        ".visa-country-button"
      );


    if (button) {

      button.addEventListener(
        "click",
        () => {

          openVisaModal(
            country.id
          );

        }
      );

    }


    return card;

  }


  /* =========================================================
     COUNTRY DESCRIPTION
  ========================================================= */

  function getCountryDescription(country) {

    if (
      country.visaTypes &&
      country.visaTypes.length
    ) {

      return country
        .visaTypes[0]
        .shortDescription ||
        "Explore student visa information.";

    }

    return "Explore student visa information.";

  }


  /* =========================================================
     RESULTS TEXT
  ========================================================= */

  function updateResultsText(count) {

    if (!resultsText) return;

    if (count === 1) {

      resultsText.textContent =
        "1 destination";

    } else {

      resultsText.textContent =
        `${count} destinations`;

    }

  }


  /* =========================================================
     EMPTY STATE
  ========================================================= */

  function showEmptyState() {

    if (empty) {
      empty.classList.remove("hidden");
    }

    if (resultsText) {
      resultsText.textContent =
        "No destinations found";
    }

  }


  function hideEmptyState() {

    if (empty) {
      empty.classList.add("hidden");
    }

  }


  /* =========================================================
     SEARCH
  ========================================================= */

  function applyFilters() {

    const filtered =
      getFilteredCountries();

    renderCountries(filtered);

  }


  if (searchInput) {

    searchInput.addEventListener(
      "input",
      applyFilters
    );

  }


  /* =========================================================
     CLEAR SEARCH
  ========================================================= */

  if (clearSearchButton) {

    clearSearchButton.addEventListener(
      "click",
      () => {

        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }

        applyFilters();

      }
    );

  }


  /* =========================================================
     REGION FILTER
  ========================================================= */

  if (regionFilter) {

    regionFilter.addEventListener(
      "change",
      applyFilters
    );

  }


  /* =========================================================
     VISA TYPE FILTER
  ========================================================= */

  if (visaTypeFilter) {

    visaTypeFilter.addEventListener(
      "change",
      applyFilters
    );

  }


  /* =========================================================
     RESET FILTERS
  ========================================================= */

  function resetFilters() {

    if (searchInput) {
      searchInput.value = "";
    }

    if (regionFilter) {
      regionFilter.value = "all";
    }

    if (visaTypeFilter) {
      visaTypeFilter.value = "all";
    }

    applyFilters();

  }


  if (resetButton) {

    resetButton.addEventListener(
      "click",
      resetFilters
    );

  }


  if (emptyReset) {

    emptyReset.addEventListener(
      "click",
      resetFilters
    );

  }


  /* =========================================================
     OPEN VISA MODAL
  ========================================================= */

  function openVisaModal(countryId) {

    const country =
      visaData.find(
        item => item.id === countryId
      );


    if (!country) {
      console.warn(
        "Visa country not found:",
        countryId
      );

      return;
    }


    renderVisaModal(country);


    if (modal) {

      modal.classList.remove("hidden");

      modal.setAttribute(
        "aria-hidden",
        "false"
      );

      document.body.classList.add(
        "visa-modal-open"
      );

    }

  }


  /* =========================================================
     RENDER MODAL
  ========================================================= */

  function renderVisaModal(country) {

    if (!modalBody) return;


    modalBody.innerHTML = `

      <div class="visa-modal-country">

        <div class="visa-modal-flag">
          ${country.flag || "🌎"}
        </div>

        <div>

          <span class="visa-modal-region">
            ${formatRegion(country.region)}
          </span>

          <h2 id="visaModalTitle">
            ${escapeHTML(country.country)}
          </h2>

        </div>

      </div>


      <div class="visa-modal-visa-types">

        ${country.visaTypes
          .map(visa =>
            renderVisaType(visa)
          )
          .join("")}

      </div>


      <div class="visa-modal-updated">

        Last updated:
        ${formatDate(country.lastUpdated)}

      </div>

    `;

  }


  /* =========================================================
     RENDER VISA TYPE
  ========================================================= */

  function renderVisaType(visa) {

    return `

      <article class="visa-detail-card">

        <div class="visa-detail-heading">

          <span class="visa-detail-icon">
            🛂
          </span>

          <div>

            <h3>
              ${escapeHTML(visa.name)}
            </h3>

            <p>
              ${escapeHTML(
                visa.shortDescription || ""
              )}
            </p>

          </div>

        </div>


        ${
          visa.description
            ? `
              <div class="visa-detail-section">

                <h4>
                  About this visa
                </h4>

                <p>
                  ${escapeHTML(
                    visa.description
                  )}
                </p>

              </div>
            `
            : ""
        }


        ${
          visa.eligibility &&
          visa.eligibility.length
            ? `
              <div class="visa-detail-section">

                <h4>
                  Eligibility
                </h4>

                <ul class="visa-detail-list">

                  ${visa.eligibility
                    .map(item => `
                      <li>
                        ${escapeHTML(item)}
                      </li>
                    `)
                    .join("")}

                </ul>

              </div>
            `
            : ""
        }


        ${
          visa.documents &&
          visa.documents.length
            ? `
              <div class="visa-detail-section">

                <h4>
                  Required documents
                </h4>

                <ul class="visa-detail-list">

                  ${visa.documents
                    .map(item => `
                      <li>
                        ${escapeHTML(item)}
                      </li>
                    `)
                    .join("")}

                </ul>

              </div>
            `
            : ""
        }


        ${
          visa.steps &&
          visa.steps.length
            ? `
              <div class="visa-detail-section">

                <h4>
                  Application process
                </h4>

                <div class="visa-steps">

                  ${visa.steps
                    .map(step => `

                      <div class="visa-step">

                        <div class="visa-step-number">
                          ${step.step}
                        </div>

                        <div>

                          <strong>
                            ${escapeHTML(
                              step.title
                            )}
                          </strong>

                          <p>
                            ${escapeHTML(
                              step.description
                            )}
                          </p>

                        </div>

                      </div>

                    `)
                    .join("")}

                </div>

              </div>
            `
            : ""
        }


        ${
          visa.financialRequirement
            ? `
              <div class="visa-detail-section">

                <h4>
                  Financial requirement
                </h4>

                <p>
                  ${escapeHTML(
                    visa.financialRequirement
                      .description || ""
                  )}
                </p>

              </div>
            `
            : ""
        }


        ${
          visa.processingTime
            ? `
              <div class="visa-detail-section">

                <h4>
                  Processing time
                </h4>

                <p>
                  ${escapeHTML(
                    visa.processingTime
                  )}
                </p>

              </div>
            `
            : ""
        }


        ${
          visa.officialSources &&
          visa.officialSources.length
            ? `
              <div class="visa-detail-section">

                <h4>
                  Official sources
                </h4>

                <div class="visa-official-links">

                  ${visa.officialSources
                    .map(source => `

                      <a
                        href="${escapeAttribute(source.url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ${escapeHTML(source.title)}
                        ↗
                      </a>

                    `)
                    .join("")}

                </div>

              </div>
            `
            : ""
        }

      </article>

    `;

  }


  /* =========================================================
     CLOSE MODAL
  ========================================================= */

  function closeVisaModal() {

    if (!modal) return;

    modal.classList.add("hidden");

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "visa-modal-open"
    );

  }


  if (modalClose) {

    modalClose.addEventListener(
      "click",
      closeVisaModal
    );

  }


  /* =========================================================
     CLOSE MODAL — BACKDROP
  ========================================================= */

  const modalBackdrop =
    visaPage.querySelector(
      "[data-close-visa-modal]"
    );


  if (modalBackdrop) {

    modalBackdrop.addEventListener(
      "click",
      closeVisaModal
    );

  }


  /* =========================================================
     ESC KEY
  ========================================================= */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape" &&
        modal &&
        !modal.classList.contains("hidden")
      ) {

        closeVisaModal();

      }

    }
  );


  /* =========================================================
     HELPERS
  ========================================================= */

  function formatRegion(region) {

    if (!region) return "International";

    return region
      .split("-")
      .map(word =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
      )
      .join(" ");

  }


  function formatDate(dateString) {

    if (!dateString) {
      return "Not specified";
    }

    const date =
      new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    );

  }


  /*
   * Basic HTML escaping.
   * Important because your JSON is being
   * inserted into innerHTML.
   */

  function escapeHTML(value) {

    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  function escapeAttribute(value) {

    return escapeHTML(value);

  }


  /* =========================================================
     INITIALIZE
  ========================================================= */

  loadVisaData();

});