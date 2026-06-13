# Privacy Policy — Salesforce Flow MetaData Downloader

_Last updated: 13 June 2026_

This Privacy Policy describes how the **Salesforce Flow MetaData Downloader** Chrome
extension ("the extension") handles data.

## Summary

The extension does **not** collect, store, or transmit any personal information,
Salesforce org data, Flow content, credentials, or session tokens. The only data
sent off your device is **anonymous, aggregate feature-usage analytics** used to
understand which features are used and to guide product improvements.

## What the extension does with your data

### Salesforce metadata (processed locally — never sent to us)
When you use the extension on a Salesforce page, it reads your active Salesforce
session cookie (`sid`) to authenticate requests to **your own Salesforce org** via
the official Salesforce Tooling API. Flow metadata is fetched from, and (for the
"Fix Nomenclature" feature) written back to, **your Salesforce org only**.

- Flow metadata is processed locally in your browser.
- It is shown to you, copied to your clipboard, or downloaded as a file **at your
  request**.
- Your session cookie, org data, Flow content, and any metadata are **never sent
  to the developer or any third party** other than Salesforce's own API.

### Anonymous usage analytics (the only data sent off-device)
The extension sends anonymous interaction events (for example: "popup opened",
"Download JSON clicked", "Run Analysis clicked") to Google Analytics 4 via the
Measurement Protocol. These events contain **only**:

- a randomly generated, anonymous installation identifier (not linked to you, your
  Google account, or your Salesforce org);
- a session identifier and an engagement-time value;
- the extension version number.

They do **not** contain any Flow content, field or object names, org identifiers,
hostnames, usernames, credentials, or any personally identifiable information.

This data is used solely in aggregate to understand which features are valuable and
to prioritize improvements.

## What we do NOT collect

- No personally identifiable information.
- No Salesforce org data, Flow content, or metadata.
- No usernames, passwords, session tokens, or cookies.
- No browsing history or activity on other websites.

## Data sharing

We do not sell or transfer your data to third parties. Anonymous analytics are
processed by Google Analytics on our behalf. We do not use any data to determine
creditworthiness or for lending purposes.

## Permissions

The extension requests only the permissions needed to function:

- **cookies** — read the Salesforce session cookie to authenticate Tooling API calls
  to your org.
- **tabs / activeTab** — detect the Salesforce org and Flow from the active tab's URL.
- **downloads** — save Flow metadata as a JSON file when you choose to download it.
- **storage** — store the anonymous analytics installation identifier locally.
- **host permissions** (`*.salesforce.com`, `*.force.com`, `*.visualforce.com`) —
  call the Salesforce Tooling API on your logged-in org.

## Changes to this policy

This policy may be updated from time to time. Material changes will be reflected by
updating the "Last updated" date above.

## Contact

Questions about this policy can be sent to **shauryahbtu@gmail.com** or raised as an
issue at <https://github.com/physicshaurya/Salesforce-Flow-XML/issues>.
