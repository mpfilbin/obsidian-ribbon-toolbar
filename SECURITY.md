# Security Policy

## Supported versions

Ribbon Bar is a single-maintainer plugin. Only the latest release on the [releases page](https://github.com/mpfilbin/obsidian-ribbon-toolbar/releases) receives security fixes.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

1. Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability** (<https://github.com/mpfilbin/obsidian-ribbon-toolbar/security/advisories/new>).
2. If that option is not available, open a public issue that says only that you have a security report and asks for a private contact. Do not include details, payloads or proof-of-concept files in the issue.

Please include the affected version (`manifest.json`), your Obsidian version and operating system, the steps or a minimal note/file that reproduces the problem, and what you believe the impact is.

This is a volunteer-maintained project, so there is no guaranteed response time. The maintainer will acknowledge a report as soon as they can, work with you on a fix, and credit you in the release notes if you wish.

## Scope

In scope: the plugin code in this repository (`src/`), the build and release workflows (`.github/workflows/`), and the published release assets (`main.js`, `manifest.json`, `styles.css`).

Out of scope: vulnerabilities in Obsidian itself, in other community plugins, or in third-party dependencies that do not affect this plugin's shipped bundle. Report those to the relevant project.

## What we already know

The [threat model](docs/security/threat-model.md) lists tested findings, assumptions, existing controls and recommended fixes. Please check it before reporting; a report that adds a new, reproducible finding or upgrades an item marked "Reasoned" to a working proof of concept is especially welcome.

## Safe testing

Test only on your own vault and machine with fake data. Do not attack other users, the maintainer's accounts, or GitHub infrastructure.
