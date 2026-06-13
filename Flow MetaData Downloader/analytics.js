/**
 * Anonymous UI usage analytics for the Flow MetaData Downloader extension.
 *
 * Sends fire-and-forget interaction events (button clicks, popup entry mode,
 * flow load outcomes) to GA4 via the Measurement Protocol. Manifest V3 forbids
 * remote-hosted scripts, so we POST directly rather than load gtag.js.
 *
 * PRIVACY CONTRACT (do not break):
 * Every event payload is limited to an anonymous per-install id, a session id,
 * an engagement-time hint and the extension version. NO flow content, org data,
 * hostnames, labels, counts or session cookies are ever sent. This is what keeps
 * the extension in Google's "anonymous usage analytics -> no consent" category.
 */

const MEASUREMENT_ID = "G-0JLWRD0KWG"; // GA4 Web data stream "Extension popup"
const API_SECRET = "Y8h_dxt6SJWT2OQqup48Sg"; // Measurement Protocol API secret
const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";

const SESSION_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const DEFAULT_ENGAGEMENT_TIME_MS = 100;

/**
 * Get (or lazily create) an anonymous per-install client id.
 * Stored in chrome.storage.local so it survives across popup opens.
 * @returns {Promise<string>}
 */
async function getOrCreateClientId() {
  const { clientId } = await chrome.storage.local.get("clientId");
  if (clientId) {
    return clientId;
  }
  const newClientId = crypto.randomUUID();
  await chrome.storage.local.set({ clientId: newClientId });
  return newClientId;
}

/**
 * Get (or create/refresh) a session id. Extensions have no native session, so
 * we keep a timestamped id in chrome.storage.session and expire it after 30
 * minutes of inactivity, mirroring GA4's default session window.
 * @returns {Promise<string>}
 */
async function getOrCreateSessionId() {
  let { sessionData } = await chrome.storage.session.get("sessionData");
  const now = Date.now();

  if (sessionData && sessionData.timestamp) {
    const durationMs = now - sessionData.timestamp;
    if (durationMs > SESSION_EXPIRATION_MS) {
      sessionData = null; // expired
    } else {
      sessionData.timestamp = now; // still active -> extend
      await chrome.storage.session.set({ sessionData });
    }
  }

  if (!sessionData) {
    sessionData = { session_id: String(now), timestamp: now };
    await chrome.storage.session.set({ sessionData });
  }

  return sessionData.session_id;
}

/**
 * Send a single anonymous event to GA4. Fire-and-forget: any failure
 * (offline, blocked endpoint, missing credentials) is swallowed so analytics
 * can never break a user-facing feature.
 * @param {string} eventName - one of the fixed event names from the taxonomy
 * @returns {Promise<void>}
 */
export async function track(eventName) {
  try {
    const body = {
      client_id: await getOrCreateClientId(),
      events: [
        {
          name: eventName,
          params: {
            session_id: await getOrCreateSessionId(),
            engagement_time_msec: DEFAULT_ENGAGEMENT_TIME_MS,
            ext_version: chrome.runtime.getManifest().version,
          },
        },
      ],
    };

    await fetch(
      `${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  } catch (_) {
    // Intentionally silent: telemetry must never surface to the user.
  }
}
