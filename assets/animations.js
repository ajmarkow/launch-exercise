const SCROLL_ANIMATION_TRIGGER_CLASSNAME = "scroll-trigger";
const SCROLL_ANIMATION_OFFSCREEN_CLASSNAME = "scroll-trigger--offscreen";
const SCROLL_ZOOM_IN_TRIGGER_CLASSNAME = "animate--zoom-in";
const SCROLL_ANIMATION_CANCEL_CLASSNAME = "scroll-trigger--cancel";

// Scroll in animation logic
function onIntersection(elements, observer) {
  elements.forEach((element, index) => {
    if (element.isIntersecting) {
      const elementTarget = element.target;
      if (
        elementTarget.classList.contains(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME)
      ) {
        elementTarget.classList.remove(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME);
        if (Object.hasOwn(elementTarget.dataset, "cascade")) {
          elementTarget.setAttribute("style", `--animation-order: ${index};`);
        }
      }

      observer.unobserve(elementTarget);
    } else {
      element.target.classList.add(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME);
      element.target.classList.remove(SCROLL_ANIMATION_CANCEL_CLASSNAME);
    }
  });
}

function initializeScrollAnimationTrigger(
  rootElement = document,
  isDesignModeEvent = false,
) {
  const animationTriggerElements = [
    ...rootElement.getElementsByClassName(SCROLL_ANIMATION_TRIGGER_CLASSNAME),
  ];
  if (animationTriggerElements.length === 0) {
    return;
  }

  if (isDesignModeEvent) {
    for (const element of animationTriggerElements) {
      element.classList.add("scroll-trigger--design-mode");
    }

    return;
  }

  const observer = new IntersectionObserver(onIntersection, {
    rootMargin: "0px 0px -50px 0px",
  });
  for (const element of animationTriggerElements) {
    observer.observe(element);
  }
}

// Zoom in animation logic
function initializeScrollZoomAnimationTrigger() {
  if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const animationTriggerElements = [
    ...document.getElementsByClassName(SCROLL_ZOOM_IN_TRIGGER_CLASSNAME),
  ];

  if (animationTriggerElements.length === 0) {
    return;
  }

  const scaleAmount = 0.2 / 100;

  for (const element of animationTriggerElements) {
    let isElementIsVisible = false;
    const observer = new IntersectionObserver((elements) => {
      elements.forEach((entry) => {
        isElementIsVisible = entry.isIntersecting;
      });
    });
    observer.observe(element);

    element.style.setProperty(
      "--zoom-in-ratio",
      1 + scaleAmount * percentageSeen(element),
    );

    window.addEventListener(
      "scroll",
      throttle(() => {
        if (!isElementIsVisible) {
          return;
        }

        element.style.setProperty(
          "--zoom-in-ratio",
          1 + scaleAmount * percentageSeen(element),
        );
      }),
      { passive: true },
    );
  }
}

function percentageSeen(element) {
  const viewportHeight = window.innerHeight;
  const { scrollY } = globalThis;
  const elementPositionY = element.getBoundingClientRect().top + scrollY;
  const elementHeight = element.offsetHeight;

  if (elementPositionY > scrollY + viewportHeight) {
    // If we haven't reached the image yet
    return 0;
  }

  if (elementPositionY + elementHeight < scrollY) {
    // If we've completely scrolled past the image
    return 100;
  }

  // When the image is in the viewport
  const distance = scrollY + viewportHeight - elementPositionY;
  const percentage = distance / ((viewportHeight + elementHeight) / 100);
  return Math.round(percentage);
}

globalThis.addEventListener("DOMContentLoaded", () => {
  initializeScrollAnimationTrigger();
  initializeScrollZoomAnimationTrigger();
});

if (Shopify.designMode) {
  document.addEventListener("shopify:section:load", (event) =>
    initializeScrollAnimationTrigger(event.target, true),
  );
  document.addEventListener("shopify:section:reorder", () =>
    initializeScrollAnimationTrigger(document, true),
  );
}
