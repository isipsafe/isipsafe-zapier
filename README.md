# isIPsafe for Zapier

The official [Zapier](https://zapier.com) integration for [isIPsafe](https://isipsafe.com), the free IP reputation and abuse reporting service.

[![Add to Zapier](https://img.shields.io/badge/Zapier-Add%20Integration-orange?logo=zapier)](https://zapier.com/developer/public-invite/249056/48b11dfea83ab937569e6cec9746b660/)

👉 **[Click here to accept the Zapier integration invite and add isIPsafe to your account](https://zapier.com/developer/public-invite/249056/48b11dfea83ab937569e6cec9746b660/)**

- **Check** whether an IP address is malicious before you trust it, and branch your Zap on the answer
- **Report** attackers from your logs, alerts or forms, one at a time or up to 10,000 at once
- **Watch the blocklist** and push new high-confidence addresses to your firewall, SIEM or chat

Built with the [Zapier Platform CLI](https://github.com/zapier/zapier-platform) (`zapier-platform-core` 19, Node.js 22 runtime).

## What's included

| Type | Name | What it does |
| --- | --- | --- |
| Trigger | **New Blocklist Entry** | Fires once for every address that appears on the isIPsafe blocklist. Filter by minimum score, age, IP version and country. |
| Search | **Check IP Reputation** | Abuse confidence score, report counts, categories, location and network for one address, plus an **Is Malicious** flag. |
| Search | **Find Reports for IP** | The reports filed against an address, newest first, as line items. Returns nothing when there are none. |
| Action | **Report IP** | Reports an address or a small network (up to /24 or /56) with categories from a dropdown, a comment and a time. |
| Action | **Bulk Report IPs** | Sends many reports in one request, from line items or pasted CSV (`IP,Categories,ReportDate,Comment`). |

### How "Is Malicious" is decided

Allowlisted addresses such as public DNS resolvers (`8.8.8.8`, `1.1.1.1`) come back with a score of 100 but no reports. To avoid blocking them, **Is Malicious** is true only when all of these hold:

- the address is not allowlisted,
- it has at least one report in the chosen window, and
- its abuse confidence score is at least the **Malicious Threshold** (75 by default).

### Duplicate reports

isIPsafe accepts one report per address every 15 minutes from the same account. A repeat is not an error: **Report IP** succeeds with **Duplicate** set to `true`, so Zaps that fire often do not fail. **Bulk Report IPs** reports rejected rows in **Rejected Rows** instead of failing.

## Connecting your account

1. Sign in at [isipsafe.com/login](https://isipsafe.com/login) and create a free API key (it starts with `sl_`).
2. In Zapier, add an isIPsafe step and choose **Sign in**, then paste the key.

The key is sent only to `https://isipsafe.com`, as an `Authorization: Bearer` header, never in a URL. Zapier verifies it with a lookup of `127.0.0.1`; an invalid key is rejected with a message telling you to reconnect.

A free key gives 10,000 lookups a day. When the limit is reached Zapier pauses and retries the step after the time isIPsafe asks for.

## Development

Requirements: Node.js 22 (the runtime Zapier uses; see `.nvmrc`) and npm 10 or newer.

```bash
npm ci
npm run lint       # ESLint
npm test           # Jest + nock, no network access
npm run coverage   # tests with a coverage report
npm run validate   # zapier-platform validate --without-style (offline schema check)
```

The test suite blocks all real network traffic, so it never touches the live API.

### Running an operation against the live API

The Zapier CLI can run any operation locally. Lookups work without a key; reporting and the blocklist need one. Put the key in a `.env` file (it is git-ignored) rather than on the command line:

```bash
echo 'authData_apiKey=sl_your_key_here' > .env
npx zapier-platform invoke auth test
npx zapier-platform invoke search check_ip -i '{"ip":"203.0.113.50"}'
npx zapier-platform invoke trigger new_blocklist_entry -i '{"confidenceMinimum":"90"}'
```

Avoid invoking `report_ip` or `bulk_report` against the live service unless you mean to file real, public reports. `127.0.0.2` always returns the duplicate response, which is a safe way to exercise **Report IP**.

### Project layout

```
index.js                     app definition
authentication.js            API key field, key check, connection label
lib/middleware.js            Bearer header, User-Agent, timeouts, error mapping
lib/validation.js            IP, network, category, date and CSV validation
lib/format.js                flattening API responses, the "Is Malicious" rule
triggers/                    New Blocklist Entry, hidden Categories trigger (dropdown source)
searches/                    Check IP Reputation, Find Reports for IP
creates/                     Report IP, Bulk Report IPs
test/                        Jest tests with nock
```

## Deploying (maintainers)

Nothing is deployed automatically. These are the steps for when the integration is ready to go to Zapier; the CLI command is `zapier-platform` (the old `zapier` binary was removed in CLI 19).

First time only:

```bash
npx zapier-platform login          # or set ZAPIER_DEPLOY_KEY
npx zapier-platform register "isIPsafe"   # creates the app and a local .zapierapprc (git-ignored)
```

Each release:

1. Bump `version` in `package.json` and add a section to `CHANGELOG.md`.
2. Run `npm run lint && npm test && npx zapier-platform validate` (without `--without-style`, so Zapier's integration checks run too).
3. Push the version: `npx zapier-platform push`.
4. Try it in the Zapier editor, then move users over with `npx zapier-platform promote <version>` and `npx zapier-platform migrate <old> <new>`.

The **Deploy to Zapier** GitHub workflow (`.github/workflows/deploy.yml`) does steps 2 and 3. It only runs when started by hand from the Actions tab and needs a `ZAPIER_DEPLOY_KEY` secret (a deploy key from the Zapier developer platform settings) and a `ZAPIER_APP_ID` variable in a `zapier` environment.

## Support and security

- API reference: [isipsafe.com/api](https://isipsafe.com/api)
- Issues: [github.com/isipsafe/isipsafe-zapier/issues](https://github.com/isipsafe/isipsafe-zapier/issues)
- Security reports: GitHub private vulnerability reporting or https://isipsafe.com/contact (see [SECURITY.md](SECURITY.md))

## License

[MIT](LICENSE) © 2026 WaveCentric
