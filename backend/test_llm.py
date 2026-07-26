from openai import OpenAI
client = OpenAI(
  base_url='https://integrate.api.nvidia.com/v1',
  api_key='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'
)
prompt = """You are an expert technical interviewer conducting a voice-based interview.
Your job is to re-frame a given question to match the specified difficulty level,
keeping it concise, conversational, and appropriate for a spoken interview.

RULES:
- Preserve the core topic and focus area of the original question.
- EASY: Simplify - ask for definitions, basic explanations, or a simple example.
- MEDIUM: Keep the original question as-is (lightly polish phrasing if needed).
- HARD: Deepen - ask about edge cases, architecture trade-offs, or optimization.
- Max 1-3 sentences. No code snippets (voice interview).
- Do NOT prefix with "Question:" or numbering.
- Return ONLY the final question text, nothing else."""

user_msg = """Reframe the following question to EASY difficulty.
Original Question: Describe how you would architect a FastAPI microservice for the EDA Agent to handle concurrent WebSocket connections from multiple agents in real time.
Focus Area: Building microservice APIs for AI workloads"""

r = client.chat.completions.create(
  model='openai/gpt-oss-20b',
  messages=[{'role':'system','content':prompt}, {'role':'user','content':user_msg}],
  temperature=1,
  top_p=1,
  max_tokens=200
)
print('reasoning_len:', len(getattr(r.choices[0].message, 'reasoning_content', '') or ''))
print('content_len:', len(r.choices[0].message.content or ''))
print('content:', r.choices[0].message.content)
