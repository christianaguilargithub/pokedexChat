# Pokédex Chatbot

A full-stack AI chatbot project that combines a FastAPI backend, an interactive Pokédex-inspired frontend, and tool-using LLM capabilities to answer Pokémon questions with live data and rich visual responses.

This project is designed as a portfolio-ready showcase of modern AI application development, combining:

- Python backend development with FastAPI
- LLM integration and function/tool calling
- External API integration with PokeAPI
- Frontend development with HTML, CSS, and JavaScript
- Prompt engineering and system instructions
- Local environment setup, debugging, and API key management

---

## Project Overview

The app allows a user to chat with an AI assistant about Pokémon. The assistant is not limited to generic knowledge — it can also call backend tools to fetch real Pokémon metadata such as:

- base stats
- abilities
- height and weight
- types
- generation
- habitat
- legendary/mythical status
- flavor text
- sprite and artwork URLs

The result is a conversational bot that feels like a Pokédex assistant, with a polished game-inspired interface and live data-backed answers.

---

## Why This Project Stands Out

This project demonstrates several valuable engineering skills in one application:

1. Full-stack application architecture
   - Python backend handles requests, system prompts, and tool calls
   - Frontend receives responses and renders rich content dynamically

2. AI tool use with structured function calling
   - The assistant decides when to call functions such as `get_pokemon` and `get_pokemon_species`
   - Results are passed back into the model context for a more informed final answer

3. Real-world API integration
   - The backend calls external services (PokéAPI) to enrich chatbot responses

4. UX-focused interface design
   - The frontend mirrors a Pokédex UI style with panels, sprites, stats, and a chat log

5. Practical AI engineering workflow
   - environment configuration
   - API key handling
   - debugging
   - prompt tuning
   - local development workflows

---

## Skills Demonstrated

This project brings together a broad set of skills that are highly relevant for AI product development and portfolio work:

### Backend & API Development
- Python
- FastAPI
- REST API design
- Request validation with Pydantic
- CORS configuration
- Environment variable handling with `python-dotenv`

### AI / LLM Integration
- OpenAI-compatible client usage
- Chat completion workflows
- System prompt design
- Tool calling / function calling
- Response handling and data extraction
- Model configuration and switching

### External Data Integration
- HTTP requests with `httpx`
- External API consumption
- Data transformation and response shaping
- Structured JSON payload generation

### Frontend Development
- HTML
- CSS
- JavaScript
- DOM manipulation
- Dynamic content rendering
- UI styling and interactive design

### Software Engineering Practices
- Debugging and troubleshooting
- Local server setup
- Project structure organization
- Environment management
- Readiness for portfolio presentation and demos

---

## Architecture

The application has a simple but effective architecture:

```text
Frontend (HTML + CSS + JS)
        |
        v
HTTP requests to FastAPI backend
        |
        v
FastAPI routes (/chat)
        |
        +--> LLM via OpenAI-compatible API
        |
        +--> PokeAPI data tools
        |
        +--> Structured response returned to frontend
```

### Flow

1. The user types a message in the browser.
2. The frontend sends the message to the backend `/chat` endpoint.
3. The backend sends the user message and system instructions to the LLM.
4. The model may decide to use available tools.
5. If a tool is invoked, the backend executes the corresponding function.
6. Tool results are returned to the model.
7. The model generates a final answer.
8. The backend sends a JSON response containing:
   - `reply`
   - `image_url` (when available)
   - `pokemon` metadata (when relevant)
9. The frontend updates the chat UI and the Pokédex panels.

---

## Core Features

### 1. Pokémon Chat Assistant
The assistant can answer general Pokémon questions and can use tools for more precise, data-backed information.

### 2. Tool-Calling Capabilities
The backend registers tools such as:

- `get_pokemon`
- `get_pokemon_species`

These allow the model to fetch accurate Pokémon details rather than relying only on its internal training data.

### 3. Pokédex-Inspired UI
The frontend includes:

- a chat box
- Pokémon sprite display
- stats panel
- polished Pokédex styling
- responsive layout for smaller screens

### 4. Groq/OpenAI-Compatible Model Support
The backend can be configured to use:

- Groq API
- local Ollama-compatible endpoints
- other OpenAI-compatible providers

This makes the project flexible and easy to adapt for different environments.

---

## Project Structure

```text
chatbot/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── test.py
│   ├── TUTORIAL.md
│   └── .env
├── frontend/
│   └── index.html
├── README.md
└── .gitignore
```

### Key Files

- `backend/main.py` — FastAPI app, tools, chat endpoint, and model integration
- `backend/requirements.txt` — Python dependencies
- `backend/test.py` — simple test script for model connectivity
- `frontend/index.html` — the full frontend interface
- `backend/TUTORIAL.md` — explanatory guide for the project build process

---

## How It Works

### Backend
The backend uses FastAPI to expose the following route:

- `GET /` — health check
- `POST /chat` — sends user input to the model and returns a response

The chat flow is built around a `ChatRequest` model and a configured OpenAI-compatible client.

### Tool Functions
Two key functions power the Pokémon data features:

#### `get_pokemon(name)`
Retrieves Pokémon details including:

- name
- types
- abilities
- height
- weight
- base stats
- sprite and image URLs

#### `get_pokemon_species(name)`
Retrieves species data including:

- generation
- legendary/mythical flags
- habitat
- evolution ancestry
- flavor text

These functions are registered as tools available to the LLM so it can decide when enriching the answer with real data is useful.

---

## Setup Instructions

### Prerequisites

- Python 3.10+
- VS Code recommended
- Internet access for API calls and PokeAPI
- A Groq/OpenAI-compatible API key, or use Ollama locally

### 1. Clone or open the project

```bash
cd chatbot
```

### 2. Create a virtual environment

```bash
cd backend
python -m venv venv
```

Activate it:

Windows PowerShell:

```powershell
venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in `backend/`:

```env
GROQ_API_KEY=your_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

You can also swap to a local Ollama-style setup by editing the client configuration in `main.py`.

### 5. Run the backend

```bash
uvicorn main:app --reload
```

The API will run at:

- `http://127.0.0.1:8000`

### 6. Run the frontend

From the project root:

```bash
cd frontend
python -m http.server 5500
```

Then open:

- `http://127.0.0.1:5500`

---

## Example Usage

Try prompts like:

- "Who is Pikachu?"
- "Tell me about Charizard's stats"
- "Is Articuno legendary?"
- "What is the habitat of Mew?"
- "Give me a summary of Bulbasaur's evolution line"

The assistant can answer directly or fetch structured data from the tools when appropriate.

---

## Notes on Model Configuration

The project is currently configured to use Groq by default:

```python
client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY")
)
```

The model is set with:

```python
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
```

If you prefer local inference, the code already has a commented Ollama example in `main.py`.

---

## Technical Highlights

- Function/tool calling adds real-world usefulness to the chatbot
- External data is merged into the model response pipeline
- The frontend dynamically updates both text and Pokémon content
- The UI is designed to resemble a game-style Pokédex interface
- The codebase is well-suited for showcasing AI product engineering skills

---

## Potential Improvements

This project could be extended with:

- persistent chat history in a database
- user authentication
- streaming responses for a live typing effect
- improved prompt tuning and system memory
- saved favorite Pokémon or chat histories
- deployment to cloud hosting
- Docker support
- unit tests and integration tests

---

## Portfolio Positioning

This project is a strong portfolio piece because it demonstrates practical AI engineering across the entire stack:

- building a usable AI product
- integrating a model with real tools
- designing an engaging experience
- connecting frontend and backend systems
- working with APIs, prompts, and data flow

It shows that the work is not just about prompting a model — it is about designing an end-to-end system that solves a real user problem.

---

## Final Note

This project was built as a hands-on exploration of AI application development, combining backend engineering, LLM integration, external data retrieval, and frontend design into a single polished demo.

It is intentionally structured to be easy to understand, extend, and present in a portfolio setting.
