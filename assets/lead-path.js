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
    var parts = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'campaign_id', 'ad_id'].filter(function (key) {
      return tags[key];
    }).map(function (key) { return key + '=' + tags[key]; });
    return parts.length ? 'Source: ' + parts.join(', ') : 'Source: unknown';
  }

  function isQa(name) {
    if (String(name || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'qa probe') return true;
    return /(?:\?|&)bb_qa=1(?:&|#|$)/.test(String(window.location.href || ''));
  }

  function metaOn() {
    var cfg = window.KC_META;
    return !!(cfg && cfg.enabled === true && cfg.datasetId && typeof window.fbq === 'function');
  }

  function track(kind, eventId) {
    try {
      if (!metaOn()) return false;
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
    button.disabled = true;
    button.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    if (oops) oops.hidden = true;
    return fetch(form.action, { method: 'POST', body: data })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.clone().json().catch(function () { return {}; }).then(function (body) { return { response: response, body: body }; });
      })
      .then(function (result) {
        if (result.body && result.body.ok === false) throw new Error('rejected');
        if (!qa && result.body && result.body.ok === true && result.body.test !== true) track('Lead', id);
        if (warning) {
          var problem = deliveryNote(result.body, id);
          warning.hidden = !problem;
          warning.textContent = problem;
        }
        clearLeadId();
        form.hidden = true;
        thanks.hidden = false;
        if (thanks.focus) thanks.setAttribute('tabindex', '-1');
        if (thanks.focus) thanks.focus();
      })
      .catch(function () {
        button.disabled = false;
        button.textContent = label;
        form.setAttribute('aria-busy', 'false');
        if (oops) {
          oops.hidden = false;
          if (oops.focus) oops.focus();
        }
      });
  });
})();
