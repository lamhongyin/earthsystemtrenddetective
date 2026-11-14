# Forecast hosting diagnosis

## What I found
- FORECAST_SERVICE_TOKEN: set. FORECAST_SERVICE_URL: not set. That missing URL is the exact cause of the message you see.
- No service address exists, so I could not run the health check or a signed-in test.
- No GitHub repository can be confirmed. The only git remote is Lovable's internal storage, and I can't see Git sync status. Render needs a GitHub repo, which you connect in Project settings -> Git.
- The `create_job` handler is complete (app.py is 147 lines and ends with the cancel handler). It is not cut off.

## What could break on Render
1. Port: the Dockerfile always uses port 8000. Set PORT=8000 in Render, or change CMD to `--port ${PORT:-8000}`.
2. Memory: the free instance has 512 MB. NumPy, scikit-learn, xarray, zarr and aiohttp together can come close to that limit or exceed it during NASA Zarr reads. Free instances also go to sleep.
3. Jobs live in memory: a restart or sleep deletes queued and finished jobs. The app then reports them as expired. Use exactly one always-on instance with one worker. A free instance fails this rule because it sleeps.
4. Request time: training runs in the background, so the request returns right away. Air Quality runs while the request waits, and the first NASA read can be slow.
5. Matching tokens: Render's FORECAST_SERVICE_TOKEN has to be the exact value saved in Lovable. I can't check this until the URL exists.

## Next steps after approval
- Change the Dockerfile CMD to use Render's $PORT (falls back to 8000).
- You connect GitHub, deploy on Render (Docker, root `services/forecast`, one always-on paid instance) and send the https://...onrender.com address.
- I save FORECAST_SERVICE_URL, then test /health, a signed-in job and Air Quality without showing the token.
