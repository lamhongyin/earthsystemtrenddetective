# Forecast hosting diagnosis and free-plan setup

## What I found
- FORECAST_SERVICE_TOKEN: set. FORECAST_SERVICE_URL: not set. That missing URL is the exact cause of the message you see.
- No service address exists, so I could not run the health check or a signed-in test.
- No GitHub repository can be confirmed. The only git remote is Lovable's internal storage, and I can't see Git sync status. Render needs a GitHub repo, which you connect in Project settings -> Git.
- The `create_job` handler is complete. It is not cut off.

## Limits of the free Render plan
- 512 MB of memory. The forecasting libraries and the air-quality libraries loaded together risk running out of memory.
- The service sleeps after about 15 minutes without use. The first request after that takes around 30–60 seconds to wake it.
- Waking up or restarting erases all in-memory jobs. Anyone waiting on a forecast loses it.
- The Dockerfile always uses port 8000, but Render assigns its own port.

## Changes (forecasting and air-quality calculations stay the same)
1. Service start: listen on Render's `$PORT`, falling back to 8000. Keep one worker.
2. Memory: load the air-quality libraries only when an Air Quality request comes in, so forecasting alone stays light. Reduce the active and cached job limits to fit free memory.
3. Wake-up handling in the app:
   - Before submitting, the app checks `/health` and allows a longer wait. If the service is still asleep, it shows "Forecast service is waking up (free hosting, up to about a minute)" and a Retry button. It never shows a fake result.
   - If a job disappears during polling because of a restart, the app says the service restarted on free hosting and the forecast must be submitted again. It does not retry on its own.
4. Docs: update the service README with free-plan Render steps (Docker, root `services/forecast`, Free instance, health path `/health`, same token) and these limits. Add a hosting rule to AGENTS.md.
5. Tests: add a test that the wake-up and restart messages show up correctly. Keep all existing scientific tests passing.

## What you still need to do
- Connect GitHub, create a Free Render web service and add the same token there. I'm not signing in to any hosting account for you.
- Send me the https://...onrender.com address. I'll save it and test `/health`, a signed-in forecast and Air Quality without showing the token.
