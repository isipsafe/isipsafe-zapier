# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-02

### Added

- API key authentication (sent as a Bearer header) with a key check and connection label.
- Trigger: **New Blocklist Entry**, polling the isIPsafe blocklist with score, age, IP version and country filters.
- Searches: **Check IP Reputation** (with an allowlist-aware "Is Malicious" flag) and **Find Reports for IP**.
- Actions: **Report IP** (categories as a dynamic multi-select; repeat reports within 15 minutes return `duplicate: true`) and **Bulk Report IPs** (line items or CSV, up to 10,000 rows).
- Client-side validation of addresses, networks, categories and dates, and readable error messages for 401, 422, 429 and 5xx responses.
