from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)

try:
    response = client.chat.completions.create(
        model="tinyllama",
        messages=[
            {"role": "user", "content": "Hello"}
        ]
    )

    print(response.choices[0].message.content)

except Exception as e:
    import traceback
    traceback.print_exc()