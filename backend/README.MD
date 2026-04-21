Backend quick start:

1. Set environment variables in `.env`:
	- `MONGO_URI`
	- `MONGO_DB_NAME` (example: `TutemIq`)
	- `GEMINI_API_KEY` (or `LOVABLE_API_KEY` as fallback)

2. Start the API server:

uvicorn main:app --reload