/* Kraken quote attribution. Meta Lead stays off until KC_META.datasetId is a Kraken-owned dataset and enabled is true. */
(function () {
  'use strict';

  var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'campaign_id', 'adset_id', 'ad_id', 'fbclid'];
  var COOKIE = 'kc_attr_v1';
  var MAX_AGE = 7 * 24 * 60 * 60;
  var DETAILS = 'fields[field_15a1024][raw_value]';
  var leadId = '';

  function uuid() {
    var cryptoApi = window.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function store() {
    try { return window.sessionStorage || null; } catch (error) { return null; }
  }

  function currentLeadId() {
    if (leadId) return leadId;
    var memory = store();
    try {
      var saved = memory && memory.getItem('kc_lead_id');
      if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return (leadId = saved);
    } catch (error) { /* keep the in-page id */ }
    leadId = uuid();
    try { if (memory) memory.setItem('kc_lead_id', leadId); } catch (error) { /* receipt still works */ }
    return leadId;
  }

  function clearLeadId() {
    leadId = '';
    try { var memory = store(); if (memory) memory.removeItem('kc_lead_id'); } catch (error) { /* ignore */ }
  }

  function queryMap(href) {
    var out = {};
    var query = String(href || '').split('?')[1] || '';
    query.split('#')[0].split('&').forEach(function (pair) {
      try {
        var cut = pair.indexOf('=');
        var key = decodeURIComponent((cut >= 0 ? pair.slice(0, cut) : pair).replace(/\+/g, ' '));
        if (ATTR_KEYS.indexOf(key) === -1) return;
        var value = decodeURIComponent((cut >= 0 ? pair.slice(cut + 1) : '').replace(/\+/g, ' '));
        if (!(key in out)) out[key] = value;
      } catch (error) { /* A malformed optional tag must never block an inquiry. */ }
    });
    return out;
  }

  function cleanTag(value, key) {
    var text = String(value || '').trim();
    if (!text || text.length > 200 || /[<>{}\u0000-\u001f]/.test(text)) return '';
    // Meta IDs are long numeric strings, not phone numbers. Never parse as Number.
    if (['campaign_id', 'adset_id', 'ad_id', 'utm_id'].indexOf(key) !== -1 && /^\d{1,30}$/.test(text)) return text;
    if (key === 'fbclid') return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
    if (/\d{10,}/.test(text) || /@/.test(text)) return '';
    return text;
  }

  function picked(source) {
    var tags = {};
    ATTR_KEYS.forEach(function (key) {
      var value = cleanTag(source[key], key);
      if (value) tags[key] = value;
    });
    return tags;
  }

  function readCookie() {
    try {
      var parts = String(document.cookie || '').split(';');
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (part.indexOf(COOKIE + '=') === 0) return decodeURIComponent(part.slice(COOKIE.length + 1));
      }
    } catch (error) { /* cookies can be blocked */ }
    return '';
  }

  function attribution() {
    var incoming = picked(queryMap(window.location.href));
    var record = null;
    try {
      record = JSON.parse(readCookie() || 'null');
      if (!record || !record.expiresAt || record.expiresAt < Date.now()) record = null;
      else {
        record.first = picked(record.first || {});
        record.last = picked(record.last || {});
      }
    } catch (error) { record = null; }
    var now = Date.now();
    if (!record) record = { first: incoming, last: incoming, expiresAt: now + MAX_AGE * 1000 };
    else if (Object.keys(incoming).length) {
      record.last = incoming;
      if (!Object.keys(record.first).length) record.first = incoming;
    }
    var known = Object.keys(record.first).length || Object.keys(record.last).length;
    if (known) {
      try {
        var secure = String(window.location.href || '').indexOf('https:') === 0 ? '; Secure' : '';
        document.cookie = COOKIE + '=' + encodeURIComponent(JSON.stringify(record)) + '; Path=/; Max-Age=' + MAX_AGE + '; SameSite=Lax' + secure;
      } catch (error) { /* attribution must not block the quote */ }
    }
    return { confidence: known ? 'campaign-tags' : 'unknown', first: record.first, last: record.last };
  }

  function safeAttribution() {
    try { return attribution(); }
    catch (error) { return { confidence: 'unknown', first: {}, last: {} }; }
  }

  // Capture the tagged landing before the visitor browses away without submitting.
  safeAttribution();

  function sourceLine(attr) {
    var tags = Object.keys(attr.first || {}).length ? attr.first : (attr.last || {});
    var parts = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'campaign_id', 'adset_id', 'ad_id', 'fbclid'].filter(function (key) {
      return tags[key];
    }).map(function (key) { return key + '=' + tags[key]; });
    return parts.length ? 'Source: ' + parts.join(', ') : 'Source: unknown';
  }

  function isQa(name) {
    var normalized = String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized === 'qa probe' || normalized === 'test thomas' || normalized === 'qa probe qa probe') return true;
    return /(?:\?|&)(?:kc_qa|bb_qa)=1(?:&|#|$)/.test(String(window.location.href || ''));
  }

  function metaConfig() {
    var cfg = window.KC_META;
    if (!cfg || cfg.enabled !== true || !cfg.datasetId) return null;
    if (cfg.business && String(cfg.business) !== 'kraken-concrete-coatings') return null;
    return cfg;
  }

  function analyticsBlocked() {
    try {
      if (navigator.globalPrivacyControl === true) return true;
      var dnt = navigator.doNotTrack || window.doNotTrack;
      if (dnt === '1' || dnt === 'yes') return true;
    } catch (error) { /* preference lookup must not block the quote */ }
    return false;
  }

  function queryAllowed() {
    var query = String(window.location.href || '').split('?')[1] || '';
    query = query.split('#')[0];
    if (!query) return true;
    var allowed = { bb_qa: true, kc_qa: true };
    ATTR_KEYS.forEach(function (key) { allowed[key] = true; });
    var ok = true;
    query.split('&').forEach(function (pair) {
      if (!pair) return;
      var cut = pair.indexOf('=');
      var key = cut >= 0 ? pair.slice(0, cut) : pair;
      var value = cut >= 0 ? pair.slice(cut + 1) : '';
      try {
        key = decodeURIComponent(key.replace(/\+/g, ' '));
        value = decodeURIComponent(value.replace(/\+/g, ' '));
      } catch (error) { ok = false; return; }
      if (!allowed[key] || /phone|email|name/i.test(key) || /@/.test(value)) ok = false;
    });
    return ok;
  }

  function installPixel() {
    var cfg = metaConfig();
    if (!cfg || analyticsBlocked() || !queryAllowed()) return false;
    if (typeof document.createElement !== 'function' || typeof document.getElementsByTagName !== 'function') return false;
    var pixelId = String(cfg.datasetId || '');
    if (!/^\d{5,30}$/.test(pixelId)) return false;
    if (window.__kcPixelId === pixelId) return true;
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      if (s && s.parentNode) s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    try {
      window.fbq('set', 'autoConfig', false, pixelId);
      window.fbq('init', pixelId);
      window.__kcPixelId = pixelId;
      return true;
    } catch (error) { return false; }
  }

  function track(kind, eventId) {
    try {
      if (!metaConfig() || analyticsBlocked() || !queryAllowed()) return false;
      if (kind === 'CallIntent') {
        var named = document.querySelector ? document.querySelector('[name="fields[name][value]"]') : null;
        if (isQa(named && named.value)) return false;
      }
      installPixel();
      if (typeof window.fbq !== 'function') return false;
      if (kind === 'Lead') window.fbq('track', 'Lead', {}, { eventID: eventId });
      else window.fbq('trackCustom', 'CallIntent', {}, { eventID: eventId });
      return true;
    } catch (error) { return false; }
  }

  function deliveryNote(body, id) {
    var notify = body && body.notify;
    if (!notify || typeof notify !== 'object') return '';
    var failed = [];
    if (notify.email === false || notify.email === 'failed') failed.push('email');
    if (notify.sms === false || notify.sms === 'failed') failed.push('text');
    if (!failed.length) return '';
    return 'Your request was accepted, but the ' + failed.join(' and ') + ' alert to Emmanuel did not confirm. Please call (406) 223-9149. Reference ' + id + '.';
  }

  function alertsConfirmed(body) {
    var notify = body && body.notify;
    if (!notify || typeof notify !== 'object') return false;
    if (notify.email === false || notify.email === 'failed') return false;
    if (notify.sms === false || notify.sms === 'failed') return false;
    return notify.email === 'provider-accepted' || notify.sms === 'provider-accepted';
  }

  function showHold(title, message) {
    if (!oops) return;
    var heading = oops.querySelector('h3');
    var copy = oops.querySelector('p');
    if (heading) heading.textContent = title;
    if (copy) {
      copy.textContent = message + ' ';
      var link = document.createElement('a');
      link.href = 'tel:+14062239149';
      link.textContent = '(406) 223-9149';
      copy.appendChild(link);
      copy.appendChild(document.createTextNode('.'));
    }
    oops.hidden = false;
    if (oops.focus) oops.focus();
  }

  document.addEventListener('click', function (event) {
    var node = event.target;
    while (node) {
      if (node.getAttribute && String(node.getAttribute('href') || '').indexOf('tel:') === 0) {
        track('CallIntent', uuid());
        return;
      }
      node = node.parentElement || null;
    }
  }, true);

  var form = document.getElementById('quoteForm');
  var thanks = document.getElementById('formThanks');
  var oops = document.getElementById('formError');
  var warning = document.getElementById('quoteDeliveryWarning');
  if (!form || !thanks) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (form.getAttribute('aria-busy') === 'true') return;
    var button = form.querySelector('button[type="submit"]');
    var label = button.textContent;
    var data = new FormData(form);
    var name = data.get('fields[name][value]') || '';
    var qa = isQa(name);
    var id = currentLeadId();
    var attr = safeAttribution();
    var details = String(data.get(DETAILS) || '');
    var note = 'Lead ID: ' + id + '\n' + sourceLine(attr) + (qa ? '\nQA: exclude from ads' : '');
    if (details.indexOf('Lead ID: ' + id) === -1) data.set(DETAILS, (details ? details.replace(/\s+$/, '') + '\n' : '') + note);
    data.set('leadId', id);
    data.set('eventId', id);
    data.set('qa', qa ? 'true' : 'false');
    data.set('sourceLine', sourceLine(attr));
    button.disabled = true;
    button.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    if (oops) oops.hidden = true;
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 25000);
    return fetch(form.action, { method: 'POST', body: data, signal: controller.signal })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          return { ok: response.ok, status: response.status, body: body || {} };
        });
      })
      .then(function (result) {
        var body = result.body || {};
        if (body.error === 'receipt_busy' || body.status === 'processing') {
          showHold('Still sending.', 'Your request is still being sent. This does not mean it failed. Your reference is ' + id + '. You can keep this page open or call Emmanuel at');
          return;
        }
        if (body.error === 'receipt_unknown' || body.status === 'unknown') {
          showHold('Not confirmed.', 'We could not confirm whether Kraken received this request. Your reference is ' + id + '. Calling Emmanuel is the sure way to reach him. Sending again will not create another notice while this one is unresolved. Call');
          return;
        }
        if (!result.ok || body.ok === false || body.status === 'rejected') throw new Error('rejected');
        if (body.ok !== true) throw new Error('unconfirmed');
        if (!qa && body.test !== true) track('Lead', id);
        if (warning) {
          var problem = deliveryNote(body, id);
          warning.hidden = !problem;
          warning.textContent = problem;
        }
        if (alertsConfirmed(body)) clearLeadId();
        form.hidden = true;
        thanks.hidden = false;
        if (thanks.focus) thanks.setAttribute('tabindex', '-1');
        if (thanks.focus) thanks.focus();
      })
      .catch(function (error) {
        if (error && error.name === 'AbortError') {
          showHold('Not confirmed.', 'The page stopped waiting, so the result is unknown. Your details are still here. Reference ' + id + '. Call Emmanuel at');
          return;
        }
        if (error && error.message === 'rejected') {
          showHold('That Didn\'t Send.', 'Something went wrong on our end. Your details are still in the form, so you can try again. If it keeps failing, call Emmanuel at');
          return;
        }
        showHold('Not confirmed.', 'The page did not get a confirmed result, so the outcome is unknown. Your details are still here. Reference ' + id + '. Call Emmanuel at');
      })
      .then(function () {
        window.clearTimeout(timer);
        button.disabled = false;
        button.textContent = label;
        form.setAttribute('aria-busy', 'false');
      });
  });
})();
