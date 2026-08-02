# Contributing to SatyaShield

Thank you for helping improve SatyaShield. Contributions should preserve the project's privacy, authorization, evidence-handling, accessibility, and safety boundaries.

## Before contributing

- Search existing issues before opening a new one.
- Use a dedicated development database and synthetic test data only.
- Never submit real complaints, evidence, identities, credentials, locations, tokens, secrets, or private organization information.
- Do not enable external AI, real emergency delivery, or unverified notification recipients.
- Do not publish sensitive vulnerability details, credentials, or personal data in a public issue.

## Development workflow

1. Fork the repository and create a focused branch.
2. Install dependencies with `npm install`.
3. Copy the example environment files and use unique local secrets.
4. Make a small, clearly scoped change.
5. Add or update relevant tests and documentation.
6. Run the applicable validation commands before opening a pull request.

```bash
npm run test:i18n --workspace client
npm test --workspace client
npm run build
npm test --workspace server
```

MongoDB and browser suites must use guarded test databases, fake adapters, and isolated evidence storage. Clean test records and artifacts after execution.

## Pull requests

Pull requests should explain what changed, why it changed, how it was tested, and whether security, privacy, accessibility, localization, or deployment behavior is affected. Keep unrelated changes in separate pull requests.

All user-visible English text should use the translation system and include a matching Hindi catalog entry. Do not claim professional translation, legal approval, emergency delivery, guaranteed response, or production readiness.

By contributing, you agree that your contribution will be licensed under the repository's [MIT License](LICENSE).
