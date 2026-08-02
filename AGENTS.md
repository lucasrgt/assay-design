# Assay Design

- Keep every production file at or below 500 tokei code lines; the product has no aggregate LOC ceiling.
- Preserve at least 95% line, statement, and function coverage; branch coverage stays at least 90%.
- The contract in `.design/` is canonical. Figma and Storybook are projections, never authorities.
- All verdicts flow through `avp-assay`; do not create a parallel pass/fail protocol.
- Keep framework integrations optional. Core, CLI, and MCP remain frontend-language neutral.
- Run `npm run check` before commit or publish.
