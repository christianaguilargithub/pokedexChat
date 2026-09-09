# Build a Production-Style AI Chatbot From Zero — Complete Code-Along Guide

This guide assumes **zero prior knowledge** of building AI applications. If you can open VS Code and run a terminal command, you can follow this.

We build one project that grows through 8 phases:

1. Basic chatbot (no memory)
2. Memory (conversation history)
3. Streaming responses
4. Save chats to a real database
5. PDF upload
6. RAG (Retrieval-Augmented Generation)
7. Vector database (real similarity search)
8. Production (auth, Docker, deployment)

**Rule of this tutorial:** you never copy-paste a block of code you don't understand. Every code block below is followed by a line-by-line explanation. If something is unclear, stop and re-read before moving on — later phases depend on earlier ones.

---

## Phase 0 — Environment Setup

### 0.1 Install the tools

You need three things installed on your machine:

| Tool | Why | Check it's installed |
|---|---|---|
| **Python 3.10+** | Runs our backend | `python3 --version` |
| **Node.js 18+** | Runs our frontend build tools (later phases) | `node --version` |
| **VS Code** | Your editor | You already have this |

If any command fails, install from python.org and nodejs.org.

### 0.2 Recommended VS Code extensions

Open the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`) and install:
- **Python** (by Microsoft)
- **Pylance**
- **ES7+ React snippets** (for later phases)
- **Thunder Client** or **REST Client** — lets you test backend endpoints without a frontend at all. Very useful for debugging.

### 0.3 Get an LLM API key

You need access to an LLM. The easiest path for beginners:
1. Go to https://platform.openai.com/api-keys
2. Create an account, add a small amount of billing credit (a few dollars is enough for this whole tutorial)
3. Create an API key, copy it somewhere safe

(If you'd rather not pay, skip ahead to the "Free/local alternative" note in Phase 1 — you can use Ollama with a local model instead. We recommend starting with OpenAI though, since it removes one variable while you're learning everything else.)

### 0.4 Project folder structure

Create this structure. In VS Code: File → Open Folder → create a new empty folder called `chatbot`, then inside it:

```
chatbot/
├── backend/
│   └── (Python files go here)
└── frontend/
    └── (HTML/React files go here)
```

Open a terminal INSIDE VS Code (`` Ctrl+` ``) — you'll use it constantly.

### 0.5 Create a Python virtual environment

A virtual environment is an isolated Python installation just for this project, so its dependencies don't clash with other Python projects on your machine. Do this every time you start a new Python project — it's not optional in practice.

```bash
cd backend
python3 -m venv venv
```

Activate it:
```bash
# macOS/Linux
source venv/bin/activate

# Windows (PowerShell)
venv\Scripts\Activate.ps1
```

Your terminal prompt should now show `(venv)` at the start of the line. This means every `pip install` from now on goes into this isolated folder, not your whole computer. **Do this every time you open a new terminal for this project.**

---
## Phase 1 — Basic Chatbot (No Memory)

### 1.1 The concept, before any code

Three ideas you must understand before writing anything:

**What an LLM actually is.** A Large Language Model is a program that, given a sequence of text, predicts the most likely next chunk of text ("token"), one token at a time, until it decides to stop. "Chatting" with it is really: you send it the whole conversation as text, it predicts what a helpful assistant would say next, and it hands that prediction back. The model has no memory of its own between calls — every single API request is 100% independent. Any "memory" your chatbot has is something YOU build by re-sending the history every time.

**Roles.** Every message sent to a chat-based LLM API has a role:
- `system` — instructions that set the assistant's behavior ("You are a helpful assistant that only answers in French")
- `user` — what the human typed
- `assistant` — what the AI previously replied (used when you resend history)

**The request/response cycle.** This is the entire flow, always:
```
Frontend (React/HTML)  --POST JSON-->  Backend (FastAPI)  --API call-->  LLM
Frontend               <--JSON reply-- Backend            <--response-- LLM
```
Your backend NEVER lets the frontend call the LLM API directly. Why? Because that would expose your secret API key to anyone who opens their browser dev tools. The backend's job is partly just: *hide the API key and be a safe middleman.*

### 1.2 Install backend dependencies

Inside `backend/` with your venv activated:

```bash
pip install fastapi "uvicorn[standard]" openai python-dotenv pydantic
```

What each package is:
- **fastapi** — the web framework. It turns Python functions into HTTP endpoints.
- **uvicorn** — the actual server that runs your FastAPI app and listens for network requests.
- **openai** — official Python client for calling OpenAI's API.
- **python-dotenv** — loads secrets from a `.env` file into environment variables, so you never hardcode your API key in source code.
- **pydantic** — FastAPI uses this to validate incoming JSON automatically.

### 1.3 Store your API key safely

Create `backend/.env`:
```
OPENAI_API_KEY=sk-your-real-key-here
```

Create `backend/.gitignore` (so you never accidentally commit your key to git):
```
venv/
.env
__pycache__/
```

### 1.4 Write the backend — `backend/main.py`

```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class ChatRequest(BaseModel):
    message: str


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.post("/chat")
def chat(request: ChatRequest):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": request.message},
        ],
    )
    reply = response.choices[0].message.content
    return {"reply": reply}
```

### 1.5 Line-by-line explanation

- `load_dotenv()` — reads `.env` and injects its variables into `os.environ`, so `os.getenv("OPENAI_API_KEY")` finds it.
- `app = FastAPI()` — the central object. Every route (`@app.get`, `@app.post`) attaches to it.
- `CORSMiddleware` — without this, your browser will BLOCK the frontend's request to the backend with a CORS error, because they're on different ports. This is a browser security feature, not a bug.
- `class ChatRequest(BaseModel)` — defines the *shape* of JSON we expect: `{"message": "some string"}`. If the frontend sends something that doesn't match (e.g. missing `message`), FastAPI automatically returns a 422 error before your function even runs. This is "input validation for free."
- `@app.post("/chat")` — a decorator. It registers the function below it to run whenever a POST request hits `/chat`.
- `def chat(request: ChatRequest)` — FastAPI sees the type hint `ChatRequest`, parses the incoming JSON body into that object, and validates it. `request.message` is now a plain Python string.
- `client.chat.completions.create(...)` — the actual network call to OpenAI. `model` picks which LLM. `messages` is the array of role/content pairs described above.
- `response.choices[0].message.content` — the API can technically return multiple candidate replies (`choices`), we just take the first one, and grab its text content.
- `return {"reply": reply}` — FastAPI automatically converts this Python dict into a JSON HTTP response.

### 1.6 Run the backend

```bash
uvicorn main:app --reload
```
- `main` = the filename `main.py` (without `.py`)
- `app` = the FastAPI object variable name inside it
- `--reload` = auto-restart the server whenever you save a file (dev only — never use in production)

Visit `http://127.0.0.1:8000` in your browser — you should see `{"status":"ok"}`. Visit `http://127.0.0.1:8000/docs` — FastAPI auto-generates an interactive API tester for every endpoint. Use this constantly to test `/chat` without a frontend at all.

### 1.7 Build the frontend (plain HTML first, on purpose)

We start with plain HTML/JS — not React — for one reason: **you should see the raw `fetch()` call with nothing hidden behind a framework.** Once you understand this, moving to React is just moving the same logic into components.

`frontend/index.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Phase 1 Chatbot</title></head>
<body>
  <div id="chat-window"></div>
  <input id="message-input" type="text" />
  <button onclick="sendMessage()">Send</button>

<script>
const BACKEND_URL = "http://127.0.0.1:8000";

async function sendMessage() {
  const input = document.getElementById("message-input");
  const message = input.value;
  input.value = "";

  const response = await fetch(BACKEND_URL + "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message }),
  });

  const data = await response.json();
  document.getElementById("chat-window").innerHTML += "<p>You: " + message + "</p><p>AI: " + data.reply + "</p>";
}
</script>
</body>
</html>
```

Do not double-click this file to open it with a `file://` URL. Browsers treat `file:` pages as unique security origins, which can prevent the page from calling the backend. Serve the `frontend/` folder over HTTP instead:

```powershell
# Run this from the project root (chatbot/)
cd frontend
..\backend\venv\Scripts\python.exe -m http.server 5500
```

On macOS/Linux, from the project root run `cd frontend && python3 -m http.server 5500` instead. Then open `http://127.0.0.1:5500` in your browser. Type a message and hit Send. **You now have a working AI chatbot.** No memory, no database, no styling — but the full request/response loop is real and working.

A more polished, styled version of this exact file is included alongside this guide as `frontend/index.html` in the starter project — same logic, nicer CSS.

### 1.8 Free/local alternative to OpenAI

If you don't want to pay for API usage while learning: install [Ollama](https://ollama.com), run `ollama pull llama3`, then point the `OpenAI` client at Ollama's OpenAI-compatible endpoint instead:
```python
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
```
Everything else in this tutorial stays identical — this is the benefit of the OpenAI-compatible API shape being an informal industry standard.

### Checkpoint
Before moving on, confirm: you can type a message in the browser, see it appear, and get a real AI reply back. If you understand every line in `main.py`, you've genuinely learned the core loop of "AI engineering" — everything else in this guide is refinement on top of this.

## Phase 2 — Memory (Conversation History)

### 2.1 The problem

Right now every `/chat` call is stateless — the backend has no idea what was said before. Ask "what's my name?" after telling it your name, and it won't know.

### 2.2 The fix: resend the whole history every time

There is no magic "remember" button on the LLM side. The fix is: **the backend keeps a list of every message in the conversation, and resends the ENTIRE list on every request.** The LLM "feels" like it remembers because it's re-reading the whole transcript each time.

For now (before we have a database in Phase 4), we'll store history in a simple Python dictionary in memory. This is temporary — it resets when the server restarts, and doesn't work across multiple users properly. That's exactly why Phase 4 introduces a real database. But you should see the simple version first.

```python
# In-memory store: { conversation_id: [ {role, content}, ... ] }
conversations: dict[str, list[dict]] = {}

class ChatRequest(BaseModel):
    conversation_id: str
    message: str

@app.post("/chat")
def chat(request: ChatRequest):
    history = conversations.get(request.conversation_id, [])

    if not history:
        history.append({"role": "system", "content": "You are a helpful assistant."})

    history.append({"role": "user", "content": request.message})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=history,
    )
    reply = response.choices[0].message.content

    history.append({"role": "assistant", "content": reply})
    conversations[request.conversation_id] = history

    return {"reply": reply}
```

### 2.3 Explanation

- `conversations` is a dictionary keyed by a conversation ID (the frontend generates this, e.g. a random string, once per chat session).
- Every request: fetch that conversation's history, append the new user message, send the WHOLE list to the LLM, then append the assistant's reply back into the same list so next time it's included too.
- Notice the growing cost problem: the longer the conversation, the more tokens you resend every single call, which means slower + more expensive requests. Real products solve this with summarization or trimming old messages — out of scope for now, but good to know it exists.

### 2.4 Frontend change
Generate a `conversation_id` once when the page loads (e.g. `crypto.randomUUID()`), and include it in every `fetch` body alongside `message`.

### Checkpoint
Ask the bot your name, then ask "what's my name?" in the same conversation. It should now know.

---

## Phase 3 — Streaming Responses

### 3.1 Why streaming matters

Without streaming, the browser sends a request and waits — sometimes 5-10 seconds — before anything appears. Streaming sends the reply token-by-token as the model generates it, so text appears immediately and grows in real time, like ChatGPT.

### 3.2 The mechanism: Server-Sent Events (SSE)

We keep a single HTTP connection open and the backend pushes small chunks of text down it as they arrive from the LLM, instead of waiting for the whole response then sending it all at once.

### 3.3 Backend change

```python
from fastapi.responses import StreamingResponse

@app.post("/chat/stream")
def chat_stream(request: ChatRequest):
    history = conversations.get(request.conversation_id, [])
    if not history:
        history.append({"role": "system", "content": "You are a helpful assistant."})
    history.append({"role": "user", "content": request.message})

    def event_generator():
        full_reply = ""
        stream = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=history,
            stream=True,          # <-- this is the whole trick
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                full_reply += delta
                yield delta       # send this piece to the client immediately

        history.append({"role": "assistant", "content": full_reply})
        conversations[request.conversation_id] = history

    return StreamingResponse(event_generator(), media_type="text/plain")
```

### 3.4 Explanation

- `stream=True` tells OpenAI's API to send back a sequence of small chunks instead of one final blob.
- `event_generator()` is a Python **generator function** — the `yield` keyword means "hand this piece of data to whoever is consuming me, then pause here until they ask for the next piece." This is what lets FastAPI push data out over the open connection incrementally instead of all at once.
- `StreamingResponse` wraps that generator so FastAPI streams it out over HTTP as it's produced, rather than waiting for the generator to fully finish.
- We still accumulate `full_reply` so we can save the complete message into history once streaming ends — the LLM history storage doesn't care whether it was streamed, only the frontend display does.

### 3.5 Frontend change

Plain `fetch()` + `await response.json()` won't work for streaming — you need to read the response body incrementally:

```javascript
async function sendMessageStreaming(message, conversationId) {
  const response = await fetch(BACKEND_URL + "/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId, message: message }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let aiText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    aiText += decoder.decode(value, { stream: true });
    updateAiMessageOnScreen(aiText); // re-render the growing text each chunk
  }
}
```

- `response.body.getReader()` gives you a low-level reader over the raw HTTP stream instead of waiting for the whole thing.
- Each loop iteration pulls whatever bytes have arrived so far, decodes them from bytes to text, and appends to what's displayed — giving the "typing" effect.

### Checkpoint
Send a message and watch the reply appear progressively instead of all at once.

## Phase 4 — Save Chats (Real Database)

### 4.1 Why the in-memory dict isn't enough

It disappears on server restart, doesn't scale past one server process, and can't answer "show me my past conversations." We need a real database: **PostgreSQL**.

### 4.2 Run PostgreSQL with Docker

Easiest way to get Postgres running locally without installing it directly on your machine. Create `docker-compose.yml` in your project root:

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: chatbot
      POSTGRES_PASSWORD: chatbot
      POSTGRES_DB: chatbot
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

Run it: `docker compose up -d` (needs Docker Desktop installed). This gives you a running Postgres server on `localhost:5432`.

### 4.3 The schema — three tables

```
users
  id, email, hashed_password, created_at

chats
  id, user_id (FK -> users.id), title, created_at

messages
  id, chat_id (FK -> chats.id), role, content, created_at
```

A `FK` (foreign key) means "this column's value must match an `id` in another table" — it's how we say "this message belongs to this chat, which belongs to this user."

### 4.4 Install an ORM

An ORM (Object-Relational Mapper) lets you work with database rows as Python objects instead of writing raw SQL everywhere.

```bash
pip install sqlalchemy psycopg2-binary
```

`backend/database.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "postgresql://chatbot:chatbot@localhost:5432/chatbot"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()
```

`backend/models.py`:
```python
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    chats = relationship("Chat", back_populates="user")

class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    chat_id = Column(Integer, ForeignKey("chats.id"))
    role = Column(String)      # "user" or "assistant"
    content = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    chat = relationship("Chat", back_populates="messages")
```

Create the tables once (add to a small script or run in a Python shell):
```python
from database import engine, Base
import models
Base.metadata.create_all(bind=engine)
```

### 4.5 Rewriting `/chat` to use the database instead of the dict

```python
from database import SessionLocal
from models import Chat, Message

def get_history_from_db(chat_id: int, db):
    messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at).all()
    return [{"role": m.role, "content": m.content} for m in messages]

@app.post("/chat")
def chat(request: ChatRequest):
    db = SessionLocal()
    try:
        history = get_history_from_db(request.chat_id, db)
        if not history:
            history.append({"role": "system", "content": "You are a helpful assistant."})

        history.append({"role": "user", "content": request.message})
        db.add(Message(chat_id=request.chat_id, role="user", content=request.message))
        db.commit()

        response = client.chat.completions.create(model="gpt-4o-mini", messages=history)
        reply = response.choices[0].message.content

        db.add(Message(chat_id=request.chat_id, role="assistant", content=reply))
        db.commit()

        return {"reply": reply}
    finally:
        db.close()
```

Same logic as Phase 2 — but the "list in a dict" is now permanent rows in Postgres. This is the general pattern of "leveling up" a prototype: the LOGIC doesn't change, the STORAGE does.

### Checkpoint
Restart your server. Ask something, restart the server again, ask a follow-up in the same `chat_id` — it should still remember, because history now lives in Postgres, not in RAM.

---

## Phase 5 — PDF Upload

### 5.1 Goal for this phase only

Just get a file from the user onto disk (or cloud storage). No AI involvement yet — we deliberately isolate "can I receive a file" from "can I do something smart with it," so you can debug each independently.

### 5.2 Backend endpoint

```python
from fastapi import UploadFile, File
import shutil, os

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"filename": file.filename, "status": "saved"}
```

- `UploadFile = File(...)` tells FastAPI to expect a `multipart/form-data` upload (not JSON) — this is how browsers send actual files.
- `shutil.copyfileobj` streams the uploaded file to disk in chunks rather than loading the whole thing into memory at once, which matters once files get large.

### 5.3 Frontend

```html
<input type="file" id="pdf-input" accept=".pdf" />
<button onclick="uploadPdf()">Upload</button>
<script>
async function uploadPdf() {
  const fileInput = document.getElementById("pdf-input");
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  const response = await fetch(BACKEND_URL + "/upload", {
    method: "POST",
    body: formData,   // NOTE: no Content-Type header — the browser sets it for multipart automatically
  });
  const data = await response.json();
  console.log(data);
}
</script>
```

### Checkpoint
Upload a PDF, check your `backend/uploads/` folder — the file should physically be there.

## Phase 6 — RAG (Retrieval-Augmented Generation)

### 6.1 The problem RAG solves

The LLM only knows what was in its training data plus whatever text you put in the prompt. It has never read your uploaded PDF. RAG's idea: **before calling the LLM, search your documents for the relevant snippet, and stuff that snippet into the prompt as context.**

```
User: "Who is the CEO?"
       │
       ▼
Search the uploaded PDF for text related to "CEO"
       │
       ▼
Found: "...our CEO, Jane Smith, founded the company in 2019..."
       │
       ▼
Send to LLM:
  system: "Answer using only the following context: <the snippet above>"
  user:   "Who is the CEO?"
       │
       ▼
LLM answers correctly, from a document it never saw during training
```

### 6.2 Step 1: extract text from the PDF

```bash
pip install pypdf
```

```python
from pypdf import PdfReader

def extract_text_from_pdf(path: str) -> str:
    reader = PdfReader(path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text
```

### 6.3 Step 2: naive keyword search (before vectors)

To genuinely understand WHY vector search (Phase 7) is better, first build the dumb version:

```python
def naive_search(question: str, document_text: str) -> str:
    # Split into paragraphs, return whichever paragraph contains
    # the most words from the question. Crude, but it's real "retrieval."
    paragraphs = document_text.split("\n\n")
    question_words = set(question.lower().split())

    best_paragraph = ""
    best_score = 0
    for p in paragraphs:
        score = len(question_words & set(p.lower().split()))
        if score > best_score:
            best_score = score
            best_paragraph = p
    return best_paragraph
```

This works only when the user's exact words appear in the document. Ask "who leads the company?" when the doc says "CEO" and it fails — no shared words. **This exact limitation is why we need embeddings/vector search — semantic similarity instead of literal word overlap.** Keep this naive version in your head; Phase 7 replaces `naive_search` with something that understands meaning.

### 6.4 Step 3: inject retrieved context into the prompt

```python
@app.post("/chat/rag")
def chat_with_rag(request: ChatRequest, document_text: str = ""):
    relevant_chunk = naive_search(request.message, document_text)

    system_prompt = f"""You are a helpful assistant. Answer the user's question
using ONLY the following context. If the answer isn't in the context, say you don't know.

Context:
{relevant_chunk}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message},
        ],
    )
    return {"reply": response.choices[0].message.content}
```

### Checkpoint
Upload a small PDF, ask a question whose answer literally appears in it word-for-word — you should get a correct, grounded answer. Then ask the same question with different wording and watch it fail — that failure is your motivation for Phase 7.

---

## Phase 7 — Vector Database (Real Similarity Search)

### 7.1 What an embedding is

An embedding model turns text into a list of numbers (a vector) — typically 1000+ numbers — positioned in space such that texts with **similar meaning** end up as **nearby vectors**, even if they share zero words. "CEO" and "who leads the company" end up close together in this space, even without any shared vocabulary.

### 7.2 Chunking

Documents are too long to embed as one block usefully — split into smaller chunks (e.g. ~500 words each, sometimes overlapping) so each chunk is one focused idea, and so retrieval can return just the relevant piece instead of the whole document.

```python
def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap   # overlap keeps context from being cut mid-idea
    return chunks
```

### 7.3 Generate embeddings

```python
def get_embedding(text: str) -> list[float]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding
```

### 7.4 pgvector — storing vectors in Postgres

`pgvector` is a Postgres extension that adds a `vector` column type and fast similarity search. Enable it (one time) inside your Postgres container:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

New table:
```python
from pgvector.sqlalchemy import Vector

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    content = Column(String)
    embedding = Column(Vector(1536))  # text-embedding-3-small outputs 1536 numbers
```
```bash
pip install pgvector
```

### 7.5 Store chunks + embeddings when a PDF is uploaded

```python
@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    path = save_file_to_disk(file)          # from Phase 5
    text = extract_text_from_pdf(path)      # from Phase 6
    chunks = chunk_text(text)               # from 7.2

    db = SessionLocal()
    for chunk in chunks:
        embedding = get_embedding(chunk)
        db.add(DocumentChunk(content=chunk, embedding=embedding))
    db.commit()
    db.close()

    return {"status": "processed", "chunks": len(chunks)}
```

### 7.6 Real similarity search (replaces `naive_search`)

```python
def vector_search(question: str, db, top_k: int = 3) -> list[str]:
    question_embedding = get_embedding(question)

    # <-> is pgvector's "distance between vectors" operator.
    # Smaller distance = more similar meaning. We ask Postgres to
    # sort by that distance and give us the closest matches.
    results = (
        db.query(DocumentChunk)
        .order_by(DocumentChunk.embedding.l2_distance(question_embedding))
        .limit(top_k)
        .all()
    )
    return [r.content for r in results]
```

This is a genuine similarity search across meaning, not word overlap — it's the fix for the exact failure you saw at the end of Phase 6.

### Checkpoint
Repeat the "different wording" question from Phase 6's checkpoint — it should now succeed, because retrieval is based on meaning, not exact words.

## Phase 8 — Production

This phase is about turning a working prototype into something safe to expose to real users.

### 8.1 Authentication (who is this user?)

Install:
```bash
pip install "python-jose[cryptography]" passlib bcrypt
```

Password hashing — never store plaintext passwords:
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

Issuing a JWT (JSON Web Token) after login — a signed token the frontend stores and re-sends to prove "I'm already logged in," instead of sending a password on every request:
```python
from jose import jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(hours=24)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
```

Protecting an endpoint — requiring a valid token:
```python
from fastapi import Depends, HTTPException, Header

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@app.post("/chat")
def chat(request: ChatRequest, user_id: int = Depends(get_current_user)):
    # user_id is now guaranteed to be a real, logged-in user before this line runs
    ...
```

### 8.2 Rate limiting (stop abuse and runaway API costs)

```bash
pip install slowapi
```
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/chat")
@limiter.limit("10/minute")
def chat(request: ChatRequest, ...):
    ...
```

### 8.3 Logging

```python
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chatbot")

@app.post("/chat")
def chat(request: ChatRequest, ...):
    logger.info(f"chat_id={request.chat_id} user_message_len={len(request.message)}")
    ...
```
Never log full message content in production if users may share sensitive data — log metadata (lengths, IDs, timestamps), not raw content, unless you have a clear data-handling policy that allows it.

### 8.4 Dockerize the backend

`backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Add it to `docker-compose.yml` alongside Postgres:
```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    depends_on:
      - postgres
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: chatbot
      POSTGRES_PASSWORD: chatbot
      POSTGRES_DB: chatbot
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```
Run everything with one command: `docker compose up --build`

### 8.5 Deployment options (pick one, don't overthink it for a first project)

- **Railway** or **Render** — easiest, connect your GitHub repo, they detect the `Dockerfile`, done.
- **Fly.io** — great free tier, `fly deploy` from your terminal.
- **A VPS (DigitalOcean/Linode)** — more control, more setup; good once you want to learn server administration.

For the frontend (once it's a real React app in Phase 8+): **Vercel** or **Netlify** — connect the repo, auto-deploys on every push.

### 8.6 Monitoring

At minimum, once deployed:
- Track error rates and response times (Railway/Render/Fly all show basic metrics for free)
- Track your LLM API cost dashboard (OpenAI's usage page) so a bug that loops API calls doesn't surprise you with a bill
- Set up an uptime check (e.g. UptimeRobot, free tier) that pings `/` every few minutes and alerts you if it goes down

### Final Checkpoint — the whole system together

At this point you have:
- A React-ready backend with authenticated, rate-limited endpoints
- Persistent chat history in Postgres
- PDF upload → chunking → embeddings → pgvector storage
- Retrieval-augmented, streamed LLM responses
- Everything containerized and deployable

This is the **Enterprise Document Assistant** capstone described in the original brief. From here, moving `frontend/index.html`'s logic into real React components (`ChatWindow.tsx`, `MessageInput.tsx`, `useChat.ts` hook, etc.) is a refactor of presentation, not a change in how any of the underlying system works — which is exactly why we built the logic in plain HTML/JS first.

---

## What to build next (optional extensions)

- **Multiple documents per user, with per-document permissions**
- **Conversation summarization** to control token costs on long chats
- **Citations** — return which document chunk each answer came from
- **Model routing** — cheap model for simple queries, stronger model for complex ones
- **Evals** — a small test set of Q&A pairs to check your RAG accuracy doesn't regress as you change chunking/prompts
