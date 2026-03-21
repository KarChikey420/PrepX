"""
Kimi K2 API Integration with LangChain
Uses NVIDIA NIM endpoint (OpenAI-compatible) to access Kimi K2
"""

import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

# Load environment variables from .env
load_dotenv()

# Get the API key from environment
api_key = os.getenv("KIMI_API_KEY")

if not api_key:
    raise ValueError("KIMI_API_KEY not found in .env file!")

# Initialize Kimi K2 via NVIDIA NIM (OpenAI-compatible endpoint)
llm = ChatOpenAI(
    model="moonshotai/kimi-k2-instruct",
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=api_key,
    temperature=0.6,
    max_tokens=1024,
)

# --- Quick Check ---
print("✅ Kimi K2 model initialized successfully!")
print(f"   Model : {llm.model_name}")
print(f"   Base URL: {llm.openai_api_base}")
print()

# Send a test message
messages = [
    SystemMessage(content="You are a helpful AI assistant powered by Kimi K2."),
    HumanMessage(content="Hello! Tell me one interesting fact about space in 2 sentences."),
]

print("🚀 Sending test prompt to Kimi K2...")
print("-" * 50)

response = llm.invoke(messages)

print(f"📝 Response:\n{response.content}")
print("-" * 50)
print("✅ Kimi K2 API check complete!")
