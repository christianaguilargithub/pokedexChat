import os
import json
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "https://christianaguilargithub.github.io,http://localhost:8000"
    ).split(",")
    if origin.strip()
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

# MODEL = "qwen2.5:3b"  # phi3.5 has weak tool-calling — pull this: ollama pull qwen2.5:3b


client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY")
)

MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")


class ChatRequest(BaseModel):
    message: str


def get_pokemon(name: str):
    """Base stats: types, abilities, height, weight."""
    response = httpx.get(
        f"https://pokeapi.co/api/v2/pokemon/{name.lower().strip()}",
        timeout=10,
    )
    if response.status_code == 404:
        return {"error": f"No Pokémon named {name} found."}
    response.raise_for_status()
    data = response.json()

    sprite_url = (
        data.get("sprites", {})
        .get("other", {})
        .get("official-artwork", {})
        .get("front_default")
        or data.get("sprites", {}).get("front_default")
    )

    base_stats = {
        stat["stat"]["name"]: stat["base_stat"]
        for stat in data.get("stats", [])
    }

    return {
        "name": data["name"].capitalize(),
        "types": [t["type"]["name"] for t in data["types"]],
        "abilities": [a["ability"]["name"] for a in data["abilities"]],
        "height_m": data["height"] / 10,
        "weight_kg": data["weight"] / 10,
        "base_stats": base_stats,
        "sprite_url": sprite_url,
        "image_url": sprite_url,
    }


def get_pokemon_species(name: str):
    """Generation, legendary/mythical status, evolution chain, habitat, flavor text."""
    response = httpx.get(
        f"https://pokeapi.co/api/v2/pokemon-species/{name.lower().strip()}",
        timeout=10,
    )
    if response.status_code == 404:
        return {"error": f"No Pokémon named {name} found."}
    response.raise_for_status()
    data = response.json()

    flavor = next(
        (
            entry["flavor_text"].replace("\n", " ").replace("\f", " ")
            for entry in data.get("flavor_text_entries", [])
            if entry["language"]["name"] == "en"
        ),
        None,
    )

    return {
        "name": data["name"].capitalize(),
        "generation": data["generation"]["name"],
        "is_legendary": data["is_legendary"],
        "is_mythical": data["is_mythical"],
        "habitat": data["habitat"]["name"] if data.get("habitat") else None,
        "evolves_from": data["evolves_from_species"]["name"] if data.get("evolves_from_species") else None,
        "flavor_text": flavor,
    }


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_pokemon",
            "description": "Get a Pokémon's base stats: types, abilities, height, and weight.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The Pokémon's name, e.g. pikachu"}
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pokemon_species",
            "description": "Get a Pokémon's generation, legendary/mythical status, evolution info, habitat, and description.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The Pokémon's name, e.g. articuno"}
                },
                "required": ["name"],
            },
        },
    },
]

AVAILABLE_FUNCTIONS = {
    "get_pokemon": get_pokemon,
    "get_pokemon_species": get_pokemon_species,
}


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.post("/chat")
def chat(request: ChatRequest):
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a helpful Pokémon expert assistant. Use the provided "
                    "tools when the user asks about a specific Pokémon's stats, "
                    "types, generation, or evolution. For general Pokémon trivia, "
                    "anime/game lore, or questions not covered by the tools "
                    "(e.g. 'what is Ash's first Pokémon'), answer directly from "
                    "your own knowledge."
                ),
            },
            {"role": "user", "content": request.message},
        ]

        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )

        msg = response.choices[0].message
        image_url = None
        pokemon_data = {}
        max_tool_rounds = 5

        while msg.tool_calls and max_tool_rounds > 0:
            messages.append(msg)

            for call in msg.tool_calls:
                args = json.loads(call.function.arguments)
                func = AVAILABLE_FUNCTIONS.get(call.function.name)
                result = func(**args) if func else {"error": "Unknown tool"}

                if isinstance(result, dict) and result.get("image_url"):
                    image_url = result["image_url"]

                if isinstance(result, dict) and any(
                    key in result for key in ["types", "abilities", "height_m", "weight_kg", "base_stats", "sprite_url", "generation", "habitat"]
                ):
                    pokemon_data.update(result)

                messages.append({
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result),
                })

            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )
            msg = response.choices[0].message
            max_tool_rounds -= 1

        payload = {
            "reply": msg.content or "",
            "image_url": image_url,
        }

        if pokemon_data:
            payload["pokemon"] = pokemon_data

        return payload

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}