import os
import json
import re
import httpx
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

# client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

# MODEL = "qwen2.5:3b"  # phi3.5 has weak tool-calling — pull this: ollama pull qwen2.5:3b


client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY")
)

MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")


class ChatRequest(BaseModel):
    message: str


def extract_pokemon_name(message: str):
    cleaned = message.strip()
    prefixes = [
        'tell me about ',
        'what do you know about ',
        'information about ',
        'what is ',
        'who is ',
        'pokemon ',
        'pokémon ',
    ]

    for prefix in prefixes:
        if cleaned.lower().startswith(prefix):
            return cleaned[len(prefix):].strip()

    match = re.search(r'\b(?:pokemon|pokémon)\s+([a-zA-Z-]+)\b', cleaned, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    return None


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
        pokemon_name = extract_pokemon_name(request.message)
        pokemon_data = {}
        image_url = None

        if pokemon_name:
            pokemon_result = get_pokemon(pokemon_name)

            if isinstance(pokemon_result, dict) and not pokemon_result.get("error"):
                pokemon_data.update(pokemon_result)
                image_url = pokemon_result.get("image_url") or pokemon_result.get("sprite_url")

                species_result = get_pokemon_species(pokemon_name)
                if isinstance(species_result, dict) and not species_result.get("error"):
                    pokemon_data.update(species_result)

        extra_context = ""
        if pokemon_data:
            extra_context = (
                "Use the following Pokémon data as your source of truth when answering.\n"
                f"{json.dumps(pokemon_data, ensure_ascii=False, indent=2)}\n\n"
            )

        system_message = (
            "You are a helpful Pokémon expert assistant. "
            "Answer clearly and concisely. If Pokémon data is provided in the user message, use it to answer accurately. "
            "For general Pokémon trivia or anime/game lore, answer from your own knowledge."
        )

        user_content = (
            f"{extra_context}User question: {request.message}"
            if extra_context
            else request.message
        )

        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_content},
            ],
        )

        msg = response.choices[0].message

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
