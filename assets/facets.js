class FacetFiltersForm extends HTMLElement {
  constructor() {
    super();
    this.onActiveFilterClick = this.onActiveFilterClick.bind(this);

    this.debouncedOnSubmit = debounce((event) => {
      this.onSubmitHandler(event);
    }, 800);

    const facetForm = this.querySelector("form");
    facetForm.addEventListener("input", this.debouncedOnSubmit.bind(this));

    const facetWrapper = this.querySelector("#FacetsWrapperDesktop");
    if (facetWrapper) {
      facetWrapper.addEventListener("keyup", onKeyUpEscape);
    }
  }

  static setListeners() {
    const onHistoryChange = (event) => {
      const searchParameters = event.state
        ? event.state.searchParams
        : FacetFiltersForm.searchParamsInitial;
      if (searchParameters === FacetFiltersForm.searchParamsPrev) {
        return;
      }

      FacetFiltersForm.renderPage(searchParameters, null, false);
    };

    globalThis.addEventListener("popstate", onHistoryChange);
  }

  static toggleActiveFacets(disable = true) {
    document.querySelectorAll(".js-facet-remove").forEach((element) => {
      element.classList.toggle("disabled", disable);
    });
  }

  static renderPage(searchParameters, event, updateURLHash = true) {
    FacetFiltersForm.searchParamsPrev = searchParameters;
    const sections = FacetFiltersForm.getSections();
    const updateEvent = FacetFiltersForm.startUpdateEvent(searchParameters);
    const countContainer = document.querySelector("#ProductCount");
    const countContainerDesktop = document.querySelector(
      "#ProductCountDesktop",
    );
    const loadingSpinners = document.querySelectorAll(
      ".facets-container .loading__spinner, facet-filters-form .loading__spinner",
    );
    loadingSpinners.forEach((spinner) => spinner.classList.remove("hidden"));
    document
      .querySelector("#ProductGridContainer")
      .querySelector(".collection")
      .classList.add("loading");
    if (countContainer) {
      countContainer.classList.add("loading");
    }

    if (countContainerDesktop) {
      countContainerDesktop.classList.add("loading");
    }

    sections.forEach((section) => {
      const url = `${globalThis.location.pathname}?section_id=${section.section}&${searchParameters}`;
      const filterDataUrl = (element) => element.url === url;

      FacetFiltersForm.filterData.some(filterDataUrl)
        ? FacetFiltersForm.renderSectionFromCache(
            filterDataUrl,
            event,
            updateEvent,
          )
        : FacetFiltersForm.renderSectionFromFetch(url, event, updateEvent);
    });

    if (updateURLHash) {
      FacetFiltersForm.updateURLHash(searchParameters);
    }
  }

  static startUpdateEvent(searchParameters) {
    const { SearchUpdateEvent, CollectionUpdateEvent } =
      globalThis.StandardEvents || {};
    if (!SearchUpdateEvent && !CollectionUpdateEvent) {
      return;
    }

    const facetsForm = document.querySelector("facet-filters-form");
    const facetsContainer = document.querySelector(".facets-container");
    const collectionId = facetsContainer?.dataset.collectionId || null;
    const collectionHandle = facetsContainer?.dataset.collectionHandle || "";
    const currentCount =
      parseInt(document.querySelector("#ProductCount")?.dataset.productCount) ||
      0;
    const urlSearchParameters = new URLSearchParams(searchParameters);
    const isSearchPage = facetsContainer?.dataset.template === "search";
    const isCollectionPage = facetsContainer?.dataset.template === "collection";
    const dispatchTarget = facetsForm || document;

    let deferred;

    if (isSearchPage) {
      deferred = SearchUpdateEvent.createPromise();
      dispatchTarget.dispatchEvent(
        new SearchUpdateEvent({
          search: {
            query: urlSearchParameters.get("q") || "",
            productFilters:
              SearchUpdateEvent.parseProductFilters(urlSearchParameters),
            sortKey: SearchUpdateEvent.getSortKey(urlSearchParameters),
          },
          promise: deferred.promise,
        }),
      );
    } else if (isCollectionPage) {
      // CollectionId is null for auto-generated collections (/collections/all,
      // /collections/vendors/<x>, etc.) — the SSE schema accepts that.
      deferred = CollectionUpdateEvent.createPromise();
      dispatchTarget.dispatchEvent(
        new CollectionUpdateEvent({
          collection: {
            id: collectionId,
            handle: collectionHandle,
            productsCount: currentCount,
          },
          productFilters:
            CollectionUpdateEvent.parseProductFilters(urlSearchParameters),
          sortKey: CollectionUpdateEvent.getSortKey(urlSearchParameters),
          promise: deferred.promise,
        }),
      );
    }

    if (!deferred) {
      return;
    }

    return {
      resolve(filteredCount) {
        deferred.resolve({
          [isSearchPage ? "totalCount" : "productsCount"]: filteredCount,
        });
      },
      reject: deferred.reject,
    };
  }

  static renderSectionFromFetch(url, event, updateEvent) {
    fetch(url)
      .then((response) => response.text())
      .then((html) => {
        FacetFiltersForm.filterData = [
          ...FacetFiltersForm.filterData,
          { html, url },
        ];
        FacetFiltersForm.renderSection(html, event, updateEvent);
      })
      .catch((error) => {
        console.error(error);
        updateEvent?.reject(error);
      });
  }

  static renderSectionFromCache(filterDataUrl, event, updateEvent) {
    const { html } = FacetFiltersForm.filterData.find(filterDataUrl);
    FacetFiltersForm.renderSection(html, event, updateEvent);
  }

  static renderSection(html, event, updateEvent) {
    FacetFiltersForm.renderFilters(html, event);
    FacetFiltersForm.renderProductGridContainer(html);
    FacetFiltersForm.renderProductCount(html, updateEvent);
    if (typeof initializeScrollAnimationTrigger === "function") {
      initializeScrollAnimationTrigger(html.getHTML());
    }
  }

  static renderProductGridContainer(html) {
    document.querySelector("#ProductGridContainer").innerHTML = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(":scope #ProductGridContainer")
      .getHTML();

    document
      .querySelector("#ProductGridContainer")
      .querySelectorAll(".scroll-trigger")
      .forEach((element) => {
        element.classList.add("scroll-trigger--cancel");
      });
  }

  static renderProductCount(html, updateEvent) {
    const parsedHtml = new DOMParser().parseFromString(html, "text/html");
    const sourceCount = parsedHtml.querySelector(":scope #ProductCount");
    const count = sourceCount.getHTML();
    const container = document.querySelector("#ProductCount");
    const containerDesktop = document.querySelector("#ProductCountDesktop");
    container.innerHTML = count;
    container.dataset.productCount = sourceCount.dataset.productCount || "";
    container.dataset.totalCount = sourceCount.dataset.totalCount || "";
    container.classList.remove("loading");
    if (containerDesktop) {
      containerDesktop.innerHTML = count;
      containerDesktop.classList.remove("loading");
    }

    const loadingSpinners = document.querySelectorAll(
      ".facets-container .loading__spinner, facet-filters-form .loading__spinner",
    );
    loadingSpinners.forEach((spinner) => spinner.classList.add("hidden"));

    updateEvent?.resolve(parseInt(sourceCount.dataset.productCount) || 0);
  }

  static renderFilters(html, event) {
    const parsedHTML = new DOMParser().parseFromString(html, "text/html");
    const facetDetailsElementsFromFetch = parsedHTML.querySelectorAll(
      "#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter, #FacetFiltersPillsForm .js-filter",
    );
    const facetDetailsElementsFromDom = document.querySelectorAll(
      "#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter, #FacetFiltersPillsForm .js-filter",
    );

    // Remove facets that are no longer returned from the server
    for (const currentElement of facetDetailsElementsFromDom) {
      if (
        [...facetDetailsElementsFromFetch].every(
          ({ id }) => currentElement.id !== id,
        )
      ) {
        currentElement.remove();
      }
    }

    const matchesId = (element) => {
      const jsFilter = event ? event.target.closest(".js-filter") : undefined;
      return jsFilter ? element.id === jsFilter.id : false;
    };

    const facetsToRender = [...facetDetailsElementsFromFetch].filter(
      (element) => !matchesId(element),
    );
    const countsToRender = [...facetDetailsElementsFromFetch].find(matchesId);

    facetsToRender.forEach((elementToRender, index) => {
      const currentElement = document.getElementById(elementToRender.id);
      // Element already rendered in the DOM so just update the innerHTML
      if (currentElement) {
        document.getElementById(elementToRender.id).innerHTML =
          elementToRender.getHTML();
      } else {
        if (index > 0) {
          const { className: previousElementClassName, id: previousElementId } =
            facetsToRender[index - 1];
          // Same facet type (eg horizontal/vertical or drawer/mobile)
          if (elementToRender.className === previousElementClassName) {
            document.getElementById(previousElementId).after(elementToRender);
            return;
          }
        }

        if (elementToRender.parentElement) {
          document
            .querySelector(`#${elementToRender.parentElement.id} .js-filter`)
            .before(elementToRender);
        }
      }
    });

    FacetFiltersForm.renderActiveFacets(parsedHTML);
    FacetFiltersForm.renderAdditionalElements(parsedHTML);

    if (countsToRender) {
      const closestJSFilterID = event.target.closest(".js-filter").id;

      if (closestJSFilterID) {
        FacetFiltersForm.renderCounts(
          countsToRender,
          event.target.closest(".js-filter"),
        );
        FacetFiltersForm.renderMobileCounts(
          countsToRender,
          document.getElementById(closestJSFilterID),
        );

        const newFacetDetailsElement =
          document.getElementById(closestJSFilterID);

        const isTextInput = event.target.getAttribute("type") === "text";

        if (!isTextInput) {
          // Try to return focus to the same checkbox the user just toggled,
          // re-selecting it from the freshly rendered HTML by its id.
          const originatingInputId = event.target.id;
          const matchingInput = originatingInputId
            ? newFacetDetailsElement.querySelector(
                `#${CSS.escape(originatingInputId)}`,
              )
            : null;

          if (matchingInput) {
            matchingInput.focus();
          } else {
            // Fallback to summary/close button if the checkbox can't be found
            const fallbackSelector = newFacetDetailsElement.classList.contains(
              "mobile-facets__details",
            )
              ? ".mobile-facets__close-button"
              : ".facets__summary";
            const fallbackElement =
              newFacetDetailsElement.querySelector(fallbackSelector);
            if (fallbackElement) {
              fallbackElement.focus();
            }
          }
        }
      }
    }
  }

  static renderActiveFacets(html) {
    const activeFacetElementSelectors = [
      ".active-facets-mobile",
      ".active-facets-desktop",
    ];

    for (const selector of activeFacetElementSelectors) {
      const activeFacetsElement = html.querySelector(selector);
      if (!activeFacetsElement) {
        continue;
      }

      document.querySelector(selector).innerHTML =
        activeFacetsElement.getHTML();
    }

    FacetFiltersForm.toggleActiveFacets(false);
  }

  static renderAdditionalElements(html) {
    const mobileElementSelectors = [
      ".mobile-facets__open",
      ".mobile-facets__count",
      ".sorting",
    ];

    for (const selector of mobileElementSelectors) {
      if (!html.querySelector(selector)) {
        continue;
      }

      document.querySelector(selector).innerHTML = html
        .querySelector(selector)
        .getHTML();
    }

    document
      .querySelector("#FacetFiltersFormMobile")
      .closest("menu-drawer")
      .bindEvents();
  }

  static renderCounts(source, target) {
    const targetSummary = target.querySelector(".facets__summary");
    const sourceSummary = source.querySelector(".facets__summary");

    if (sourceSummary && targetSummary) {
      targetSummary.outerHTML = sourceSummary.outerHTML;
    }

    const targetHeaderElement = target.querySelector(".facets__header");
    const sourceHeaderElement = source.querySelector(".facets__header");

    if (sourceHeaderElement && targetHeaderElement) {
      targetHeaderElement.outerHTML = sourceHeaderElement.outerHTML;
    }

    const targetWrapElement = target.querySelector(".facets-wrap");
    const sourceWrapElement = source.querySelector(".facets-wrap");

    if (sourceWrapElement && targetWrapElement) {
      const isShowingMore = Boolean(
        target.querySelector("show-more-button .label-show-more.hidden"),
      );
      if (isShowingMore) {
        sourceWrapElement
          .querySelectorAll(".facets__item.hidden")
          .forEach((hiddenItem) =>
            hiddenItem.classList.replace("hidden", "show-more-item"),
          );
      }

      targetWrapElement.outerHTML = sourceWrapElement.outerHTML;
    }
  }

  static renderMobileCounts(source, target) {
    const targetFacetsList = target.querySelector(".mobile-facets__list");
    const sourceFacetsList = source.querySelector(".mobile-facets__list");

    if (sourceFacetsList && targetFacetsList) {
      targetFacetsList.outerHTML = sourceFacetsList.outerHTML;
    }
  }

  static updateURLHash(searchParameters) {
    history.pushState(
      { searchParams: searchParameters },
      "",
      `${globalThis.location.pathname}${searchParameters && "?".concat(searchParameters)}`,
    );
  }

  static getSections() {
    return [
      {
        section: document.querySelector("#product-grid").dataset.id,
      },
    ];
  }

  createSearchParams(form) {
    const formData = new FormData(form);
    return new URLSearchParams(formData).toString();
  }

  onSubmitForm(searchParameters, event) {
    FacetFiltersForm.renderPage(searchParameters, event);
  }

  onSubmitHandler(event) {
    event.preventDefault();
    const sortFilterForms = document.querySelectorAll(
      "facet-filters-form form",
    );
    if (event.srcElement.className == "mobile-facets__checkbox") {
      const searchParameters = this.createSearchParams(
        event.target.closest("form"),
      );
      this.onSubmitForm(searchParameters, event);
    } else {
      const forms = [];
      const isMobile =
        event.target.closest("form").id === "FacetFiltersFormMobile";

      sortFilterForms.forEach((form) => {
        if (!isMobile) {
          if (
            form.id === "FacetSortForm" ||
            form.id === "FacetFiltersForm" ||
            form.id === "FacetSortDrawerForm"
          ) {
            forms.push(this.createSearchParams(form));
          }
        } else if (form.id === "FacetFiltersFormMobile") {
          forms.push(this.createSearchParams(form));
        }
      });
      this.onSubmitForm(forms.join("&"), event);
    }
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    FacetFiltersForm.toggleActiveFacets();
    const url = event.currentTarget.href.includes("?")
      ? event.currentTarget.href.slice(
          event.currentTarget.href.indexOf("?") + 1,
        )
      : "";
    FacetFiltersForm.renderPage(url);
  }
}

FacetFiltersForm.filterData = [];
FacetFiltersForm.searchParamsInitial = globalThis.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = globalThis.location.search.slice(1);
customElements.define("facet-filters-form", FacetFiltersForm);
FacetFiltersForm.setListeners();

class PriceRange extends HTMLElement {
  constructor() {
    super();
    this.querySelectorAll("input").forEach((element) => {
      element.addEventListener("change", this.onRangeChange.bind(this));
      element.addEventListener("keydown", this.onKeyDown.bind(this));
    });
    this.setMinAndMaxValues();
  }

  onRangeChange(event) {
    this.adjustToValidValues(event.currentTarget);
    this.setMinAndMaxValues();
  }

  onKeyDown(event) {
    if (event.metaKey) {
      return;
    }

    const pattern =
      /[\d ',.]|Tab|Backspace|Enter|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Delete|Escape/;
    if (!pattern.test(event.key)) {
      event.preventDefault();
    }
  }

  setMinAndMaxValues() {
    const inputs = this.querySelectorAll("input");
    const minInput = inputs[0];
    const maxInput = inputs[1];
    if (maxInput.value) {
      minInput.dataset.max = maxInput.value;
    }

    if (minInput.value) {
      maxInput.dataset.min = minInput.value;
    }

    if (minInput.value === "") {
      maxInput.dataset.min = 0;
    }

    if (maxInput.value === "") {
      minInput.dataset.max = maxInput.dataset.max;
    }
  }

  adjustToValidValues(input) {
    const value = Number(input.value);
    const min = Number(input.dataset.min);
    const max = Number(input.dataset.max);

    if (value < min) {
      input.value = min;
    }

    if (value > max) {
      input.value = max;
    }
  }
}

customElements.define("price-range", PriceRange);

class FacetRemove extends HTMLElement {
  constructor() {
    super();
    const facetLink = this.querySelector("a");
    facetLink.setAttribute("role", "button");
    facetLink.addEventListener("click", this.closeFilter.bind(this));
    facetLink.addEventListener("keyup", (event) => {
      event.preventDefault();
      if (event.code.toUpperCase() === "SPACE") {
        this.closeFilter(event);
      }
    });
  }

  closeFilter(event) {
    event.preventDefault();
    const form =
      this.closest("facet-filters-form") ||
      document.querySelector("facet-filters-form");
    form.onActiveFilterClick(event);
  }
}

customElements.define("facet-remove", FacetRemove);
