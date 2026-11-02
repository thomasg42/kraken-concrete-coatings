/* Gentle viewport-triggered motion for display photos only. */
(function () {
  "use strict";

  var photos = Array.prototype.slice.call(
    document.querySelectorAll("figure[data-agreement-motion]")
  ).filter(function (figure) {
    return !!figure.querySelector("img");
  });
  var controls = Array.prototype.slice.call(
    document.querySelectorAll("[data-agreement-motion-toggle]")
  );
  var storageKey = "kraken-agreement-photo-motion-off";
  var reducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  var connection = navigator.connection || null;
  var dataSaver = !!(connection && connection.saveData);
  var observers = new Map();
  var visible = new Set();
  var pausedByUser = false;
  try {
    pausedByUser = window.localStorage.getItem(storageKey) === "true";
  } catch (error) {
    /* Motion remains usable when storage is unavailable. */
  }

  function motionAllowed() {
    return !!(
      photos.length &&
      reducedMotion &&
      !reducedMotion.matches &&
      !dataSaver &&
      "IntersectionObserver" in window
    );
  }

  function shouldAnimate() {
    return motionAllowed() && !pausedByUser;
  }

  function syncControls() {
    var paused = !shouldAnimate();
    controls.forEach(function (button) {
      button.setAttribute("aria-pressed", paused ? "true" : "false");
      button.textContent = paused ? "Photo motion: off" : "Photo motion: on";
      button.disabled = !motionAllowed();
    });
  }

  function stop(photo) {
    photo.classList.remove("is-playing");
  }

  function clearObservers() {
    observers.forEach(function (observer) { observer.disconnect(); });
    observers.clear();
    visible.clear();
    photos.forEach(stop);
  }

  function start(photo) {
    if (!shouldAnimate() || document.hidden) return;
    photo.classList.remove("is-playing");
    /* Restart a single 3-second CSS pass after the photo enters the viewport. */
    void photo.offsetWidth;
    photo.classList.add("is-playing");
  }

  function observePhotos() {
    clearObservers();
    if (!shouldAnimate() || document.hidden) return;

    photos.forEach(function (photo) {
      var height = photo.getBoundingClientRect().height || 0;
      var threshold = height > 0
        ? Math.min(0.22, (window.innerHeight * 0.5) / height)
        : 0.22;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !visible.has(photo)) {
            visible.add(photo);
            start(photo);
          } else if (!entry.isIntersecting) {
            visible.delete(photo);
            stop(photo);
          }
        });
      }, { threshold: Math.max(0.01, threshold) });
      observers.set(photo, observer);
      observer.observe(photo);
    });
  }

  controls.forEach(function (button) {
    button.addEventListener("click", function () {
      if (!motionAllowed()) return;
      pausedByUser = !pausedByUser;
      try {
        window.localStorage.setItem(storageKey, pausedByUser ? "true" : "false");
      } catch (error) {
        /* Keep the current-page control usable when storage is unavailable. */
      }
      syncControls();
      if (pausedByUser) clearObservers();
      else observePhotos();
    });
  });

  syncControls();
  observePhotos();

  if (reducedMotion) {
    var onMotionPreferenceChange = function () {
      if (reducedMotion.matches) clearObservers();
      else observePhotos();
      syncControls();
    };
    if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", onMotionPreferenceChange);
    else if (reducedMotion.addListener) reducedMotion.addListener(onMotionPreferenceChange);
  }

  if (connection && connection.addEventListener) {
    connection.addEventListener("change", function () {
      dataSaver = !!connection.saveData;
      if (dataSaver) clearObservers();
      else observePhotos();
      syncControls();
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) photos.forEach(stop);
    else observePhotos();
  });

  window.addEventListener("resize", function () {
    if (!document.hidden) observePhotos();
  }, { passive: true });
})();
