# code-blooded

A meal suggestion website that uses ingredients you provide. Optional period
support adjusts food preferences; it does not provide medical advice.

## Run locally

1. Make sure `.env` contains your server-side `ANTHROPIC_API_KEY`. You may
   optionally set `ANTHROPIC_MODEL`.
2. Install dependencies with `npm install`.
3. Start the server with `node server.js`.
4. Open <http://localhost:3000>.

The browser sends ingredients and the optional period setting to the local
server. The server calls Anthropic; the API key is never sent to the browser.
