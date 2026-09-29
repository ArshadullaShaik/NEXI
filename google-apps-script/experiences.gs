/**
 * Google Forms -> NEXI webhook.
 *
 * Paste this into a bound Apps Script project (Extensions > Apps Script) for your Form,
 * then set an on-form-submit trigger (Triggers > Add Trigger):
 *   Function: onFormSubmit
 *   Event source: From form
 *   Event type: On form submit
 *
 * BEFORE RUNNING, edit CONFIG below:
 *   ENDPOINT - your deployed NEXI URL + /api/experiences
 *              (local: http://localhost:3000/api/experiences — Apps Script cannot reach
 *               localhost, so use your ngrok/cloudflared tunnel URL when testing)
 *   SECRET   - must match the INGEST_SECRET env var on the server
 *
 * FIELD MAPPING is positional: it maps the first N items of the form response to the
 * fields the API expects. Reorder it to match your own form, and check the order by
 * adding a temporary Logger.log(e.values) line and submitting a test entry.
 *
 * WHY THE RETRY QUEUE: Apps Script -> your server is not transactional. If the Vercel
 * deployment is cold, redeploying, or the secret is wrong, a naive post would silently
 * lose that response forever. Unsent rows go to a Script Property queue and are retried
 * by the scheduled "drainQueue" function below.
 */

var CONFIG = {
  ENDPOINT: 'https://YOUR-DEPLOYMENT.vercel.app/api/experiences',
  SECRET: 'PASTE-INGEST_SECRET-HERE',
  QUEUE_KEY: 'prc_ingest_queue',
  MAX_ATTEMPTS: 5
};

// Adjust to match your form's question order.
var FIELD_MAPPING = {
  company: 0,  // "Company"  (short answer)
  role: 1,     // "Role"
  round: 2,    // "Round"    (dropdown: OA / Interview 1 / Interview 2 / Final / ...)
  cgpa: 3,     // "Your CGPA" (optional)
  branch: 4,   // "Branch"   (optional)
  batchYear: 5,// "Batch year" (optional)
  raw: 6       // "Your experience" (long answer)
};

function onFormSubmit(e) {
  var values = (e && e.values) ? e.values : [];
  if (!values.length) return;

  var pick = function (key) {
    var i = FIELD_MAPPING[key];
    if (i == null || i >= values.length) return null;
    var v = values[i];
    return (v == null ? null : String(v).trim()) || null;
  };

  var payload = {
    company: pick('company'),
    role: pick('role'),
    round: pick('round') || 'Other',
    cgpa: pick('cgpa'),
    branch: pick('branch'),
    batchYear: pick('batchYear'),
    raw: pick('raw')
  };

  // Fail loudly on the obvious ones rather than queueing garbage that will 400 forever.
  if (!payload.company || !payload.role || !payload.raw) {
    Logger.log('prc: dropping submission with a missing company/role/experience');
    return;
  }
  if (payload.raw.length < 80) {
    Logger.log('prc: dropping submission shorter than 80 chars');
    return;
  }

  post_(payload);
}

/** POSTs one payload, queueing it on any transient failure. Returns true if delivered. */
function post_(payload) {
  try {
    var res = UrlFetchApp.fetch(CONFIG.ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-ingest-secret': CONFIG.SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) return true;

    // 4xx other than 429 = our payload is bad; retrying will not help.
    if (code >= 400 && code < 500 && code !== 429) {
      Logger.log('prc: rejected permanently (' + code + '): ' + res.getContentText());
      return true; // treat as handled so we do not loop
    }
    Logger.log('prc: transient failure ' + code + ', queueing');
  } catch (e) {
    Logger.log('prc: network error, queueing: ' + e);
  }
  enqueue_(payload);
  return false;
}

function enqueue_(payload) {
  var props = PropertiesService.getScriptProperties();
  var q = JSON.parse(props.getProperty(CONFIG.QUEUE_KEY) || '[]');
  q.push({ payload: payload, attempts: 0, at: new Date().toISOString() });
  props.setProperty(CONFIG.QUEUE_KEY, JSON.stringify(q));
  Logger.log('prc: queued, depth ' + q.length);
}

/**
 * Set a time-driven trigger (Triggers > Add Trigger):
 *   Function: drainQueue   Event source: Time-driven   Type: Every 10 minutes
 */
function drainQueue() {
  var props = PropertiesService.getScriptProperties();
  var q = JSON.parse(props.getProperty(CONFIG.QUEUE_KEY) || '[]');
  if (!q.length) return;

  var kept = [];
  for (var i = 0; i < q.length; i++) {
    var item = q[i];
    if (item.attempts >= CONFIG.MAX_ATTEMPTS) {
      Logger.log('prc: giving up on a queued submission after ' + item.attempts + ' attempts');
      continue;
    }
    item.attempts += 1;
    if (!post_(item.payload)) kept.push(item);
  }
  props.setProperty(CONFIG.QUEUE_KEY, JSON.stringify(kept));
  Logger.log('prc: drain finished, ' + kept.length + ' still queued');
}

/** Manual helper: run this once after editing CONFIG to verify the secret and endpoint. */
function testConnection() {
  var ok = post_({
    company: 'Connection Test', role: 'N/A', round: 'Other',
    raw: 'This is a connectivity check submitted by the Apps Script test button. ' +
         'If you can read this, the endpoint and secret are both working correctly. ' +
         'Delete this entry from the Firebase console afterwards.'
  });
  Logger.log('prc: connection test ' + (ok ? 'OK' : 'failed (queued)'));
}
