/* Below-hero photo motion and small keyboard improvements for the original nav. */
(function () {
  "use strict";

  var photos = Array.prototype.slice.call(
    document.querySelectorAll("picture.photo-frame[data-photo-motion]")
  ).filter(function (photo) {
    return !photo.closest(".hero-scroll, .hero, .hero-sticky, .page-hero, .home-hero") &&
      !!photo.querySelector("img");
  });
  var storageKey = "kraken-agreement-photo-motion-off";
  var reducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  var connection = navigator.connection || null;
  var dataSaver = !!(connection && connection.saveData);
  var observers = new Map();
  var visible = new Set();
  var motionOff = false;
  var motionSupported = photos.length > 0 && !!reducedMotion && "IntersectionObserver" in window;
  var toggle = null;

  try {
    motionOff = window.localStorage.getItem(storageKey) === "true";
  } catch (error) {
    /* The control still works for this page when storage is unavailable. */
  }

  function canAnimate() {
    return motionSupported && !reducedMotion.matches && !dataSaver;
  }

  function clearPhoto(photo) {
    photo.classList.remove("photo-motion-active");
  }

  function stopObserving() {
    observers.forEach(function (observer) { observer.disconnect(); });
    observers.clear();
    visible.clear();
    photos.forEach(clearPhoto);
  }

  function startPhoto(photo) {
    if (!canAnimate() || motionOff || document.hidden) return;
    photo.classList.remove("photo-motion-active");
    void photo.offsetWidth;
    photo.classList.add("photo-motion-active");
  }

  function observePhotos() {
    stopObserving();
    if (!canAnimate() || motionOff || document.hidden) return;

    photos.forEach(function (photo) {
      var height = photo.getBoundingClientRect().height || 0;
      var threshold = height > 0
        ? Math.min(0.22, (window.innerHeight * 0.5) / height)
        : 0.22;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !visible.has(photo)) {
            visible.add(photo);
            startPhoto(photo);
          } else if (!entry.isIntersecting) {
            visible.delete(photo);
            clearPhoto(photo);
          }
        });
      }, { threshold: Math.max(0.01, threshold) });
      observers.set(photo, observer);
      observer.observe(photo);
    });
  }

  function syncToggle() {
    if (!toggle) return;
    var enabled = canAnimate() && !motionOff;
    toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
    toggle.textContent = enabled ? "Photo motion: on" : "Photo motion: off";
    toggle.disabled = !canAnimate();
    toggle.setAttribute("aria-label", enabled ? "Turn photo motion off" : "Turn photo motion on");
  }

  function addMotionControl() {
    var footer = document.querySelector("footer.footer") || document.querySelector("footer");
    if (!footer) return;
    var existing = footer.querySelector("[data-photo-motion-toggle]");
    if (existing) {
      toggle = existing;
    } else {
      var host = document.createElement("div");
      host.className = "photo-motion-control";
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.setAttribute("data-photo-motion-toggle", "");
      host.appendChild(toggle);
      footer.appendChild(host);
    }

    toggle.addEventListener("click", function () {
      if (!canAnimate()) return;
      motionOff = !motionOff;
      try {
        window.localStorage.setItem(storageKey, motionOff ? "true" : "false");
      } catch (error) {
        /* Keep the control usable for the current visit. */
      }
      if (motionOff) stopObserving();
      else observePhotos();
      syncToggle();
    });
    syncToggle();
  }

  function enhanceNavigation() {
    var toggleButton = document.querySelector(".nav-toggle");
    var links = document.querySelector("#siteNav .nav-links, .nav .nav-links");
    if (!toggleButton || !links) return;

    function isOpen() {
      return links.classList.contains("open") || toggleButton.getAttribute("aria-expanded") === "true";
    }

    function setClosed(restoreFocus) {
      links.classList.remove("open");
      toggleButton.classList.remove("open");
      toggleButton.setAttribute("aria-expanded", "false");
      toggleButton.setAttribute("aria-label", "Open navigation");
      document.body.style.overflow = "";
      if (restoreFocus) toggleButton.focus();
    }

    toggleButton.addEventListener("click", function () {
      window.setTimeout(function () {
        if (isOpen()) {
          toggleButton.setAttribute("aria-expanded", "true");
          toggleButton.setAttribute("aria-label", "Close navigation");
          var firstLink = links.querySelector("a[href]");
          if (firstLink) firstLink.focus();
        } else {
          setClosed(false);
        }
      }, 0);
    });

    links.addEventListener("click", function (event) {
      if (event.target.closest("a[href]")) setClosed(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen()) {
        setClosed(true);
      }
      if (event.key === "Tab" && isOpen()) {
        var stops = Array.prototype.slice.call(links.querySelectorAll("a[href]"))
          .filter(function (link) { return link.getClientRects().length > 0; });
        stops.push(toggleButton);
        var current = stops.indexOf(document.activeElement);
        if (event.shiftKey && current === 0) {
          event.preventDefault(); toggleButton.focus();
        } else if (!event.shiftKey && document.activeElement === toggleButton) {
          event.preventDefault(); if (stops[0]) stops[0].focus();
        }
      }
    });

    function closeOnDesktop() {
      if (window.matchMedia("(min-width: 861px)").matches && isOpen()) setClosed(false);
    }
    window.addEventListener("resize", closeOnDesktop, { passive: true });
    closeOnDesktop();
  }

  function enhanceGallery() {
    var lightbox = document.querySelector('.lightbox');
    if (!lightbox) return;
    var opener = null;
    lightbox.tabIndex = -1;
    lightbox.setAttribute('aria-modal', 'true');
    document.querySelectorAll('.gallery-item').forEach(function (item) {
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', 'View photo: ' + (item.dataset.caption || item.querySelector('img').alt));
      item.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); item.click();
        }
      });
      item.addEventListener('click', function () {
        opener = item;
        lightbox.focus();
      });
    });
    function restoreGalleryFocus() { if (opener) opener.focus(); }
    lightbox.addEventListener('click', restoreGalleryFocus);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && document.activeElement === lightbox) restoreGalleryFocus();
      if (event.key === 'Tab' && lightbox.classList.contains('open')) event.preventDefault();
    });
  }

  addMotionControl();
  observePhotos();
  enhanceNavigation();
  enhanceGallery();

  if (reducedMotion) {
    var onMotionPreferenceChange = function () {
      if (reducedMotion.matches) stopObserving();
      else observePhotos();
      syncToggle();
    };
    if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", onMotionPreferenceChange);
    else if (reducedMotion.addListener) reducedMotion.addListener(onMotionPreferenceChange);
  }

  if (connection && connection.addEventListener) {
    connection.addEventListener("change", function () {
      dataSaver = !!connection.saveData;
      if (dataSaver) stopObserving();
      else observePhotos();
      syncToggle();
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) photos.forEach(clearPhoto);
    else observePhotos();
  });

  window.addEventListener("resize", function () {
    if (!document.hidden && !motionOff) observePhotos();
  }, { passive: true });
})();
