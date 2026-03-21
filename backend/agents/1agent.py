import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage


load_dotenv()

api_key = os.getenv("KIMI_API_KEY")

if not api_key:
    raise ValueError("KIMI_API_KEY not found in .env file!")


llm = ChatOpenAI(
    model="moonshotai/kimi-k2-instruct",
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=api_key,
    temperature=0.6,
    max_tokens=1024,
)

print("Kimi K2 model initialized successfully!")
print(f"   Model : {llm.model_name}")
print(f"   Base URL: {llm.openai_api_base}")
print()

messages = [
    SystemMessage(content="You are a helpful AI assistant powered by Kimi K2."),
    HumanMessage(content="Hello! Tell me one interesting fact about space in 2 sentences."),
]

print("Sending test prompt to Kimi K2...")
print("-" * 50)

response = llm.invoke(messages)

print(f"Response:\n{response.content}")
print("-" * 50)
print("Kimi K2 API check complete!")
