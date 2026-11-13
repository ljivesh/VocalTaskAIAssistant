# VocalTask: AI Meeting Assistant for Discord

A Discord bot that joins voice channels, records and transcribes each speaker with Azure Speech, then summarizes the meeting with an LLM. Summaries are embedded (e5-small via transformers.js) and stored in Postgres with pgvector, so you can ask questions about past meetings (RAG). Includes a RAG evaluation script and performance tests.

**Stack:** Node.js, discord.js / @discordjs/voice, Azure Speech, Groq (Mixtral), transformers.js, PostgreSQL + pgvector

**Run:** `npm install`, set `DISCORD_TOKEN`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `GROQ_API_KEY` and `DB_HOST/DB_NAME/DB_USER/DB_PASSWORD`, then `npm run bot`.
