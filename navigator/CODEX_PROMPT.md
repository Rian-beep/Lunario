# Kickoff prompt

Paste the block below into Codex as the first message. Do not add extra tasks in that message.

```
You are picking up the SolarReach Lunar Landing Site Navigator on this Mac.

Read AGENTS.md and HANDOFF.md in the repo root before you do anything else. Follow AGENTS.md for the whole session. HANDOFF.md is the challenge context, the requirement checklist, and the limits. Do not change app behaviour during this kickoff.

Then verify the setup, and stop:

1. Confirm Node is 20 or newer and Python is 3.12 or newer. If either is missing, say so and stop.
2. Run npm install.
3. Run npx tsc --noEmit and report the result.
4. Start npm run dev and confirm http://127.0.0.1:4317 responds. Leave the server running.
5. Do not run python3 pipeline/build_dataset.py unless the two LOLA GeoTIFFs are already on disk. If they are not, say the catalog in public/data is the one to use and do not download the DEMs.
6. Do not rebuild the standalone file unless tsc fails in a way that proves the UI bundle is stale.

When those checks are done, reply with: what you read, the typecheck result, the dev-server URL, and any command that failed. Then wait. Do not add features, do not edit files, and do not invent data.
```
