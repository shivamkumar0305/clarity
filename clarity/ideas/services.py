import json
import os
from ddgs import DDGS
from groq import Groq

client = Groq(api_key=os.environ["GROQ_API_KEY"])
MODEL = "openai/gpt-oss-120b"

ROADMAP_SCHEMA = {
    "type": "object",
    "properties": {
        "idea_title": {"type": "string"},
        "phases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "phase_name": {"type": "string"},
                    "steps": {"type": "array", "items": {"type": "string"}},
                    "milestone": {"type": "string"},
                    "skills_required": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "skill_name": {"type": "string"},
                                "resources": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "title": {"type": "string"},
                                            "url": {"type": "string"},
                                        },
                                        "required": ["title", "url"],
                                        "additionalProperties": False,
                                    },
                                },
                            },
                            "required": ["skill_name", "resources"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["phase_name", "steps", "milestone", "skills_required"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["idea_title", "phases"],
    "additionalProperties": False,
}

RESEARCHER_PROMPT = """You are an expert technical mentor. Given a project or startup idea:
1. Break it into 3-5 sequential phases.
2. For each phase, list implementation steps, milestone, and required skills.
3. SELECTIVITY: Only provide resource links for the TOP 2-4 core technical frameworks or libraries across the entire project (e.g., React, PostgreSQL, Docker). Do NOT search for soft skills, basic concepts, or generic topics (e.g., "User Research", "Git basics").

CRITICAL SEARCH RULE:
- You are allowed ONE round of searches.
- Submit all necessary queries in parallel at the same time using `web_search`.
- After receiving the search results, immediately generate your full response."""

FORMATTER_PROMPT = """You are a strict data formatting assistant.
Your only job is to take the provided text and map it into a single JSON object.

CRITICAL STRUCTURAL RULE:
- The root of your output MUST be a JSON OBJECT: {"idea_title": "...", "phases": [...]}.
- Do NOT output a top-level JSON array like [{...}]. The root element MUST be an object.

RULES:
1. Do not invent, guess, or hallucinate any information.
2. Only include skills and resource links that are explicitly mentioned in the provided text.
3. If a phase doesn't mention specific resources for a skill, leave the resources array empty.
4. Ensure the output strictly validates against the requested JSON schema."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for up-to-date documentation, tutorials, or courses.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The exact search query (e.g., 'React official documentation')",
                    }
                },
                "required": ["query"],
            },
        },
    }
]


from concurrent.futures import ThreadPoolExecutor, TimeoutError


def _fetch_ddgs(query: str, max_results: int = 3) -> str:
    results = DDGS().text(query, max_results=max_results)
    if not results:
        return "No results found."
    return "\n\n".join(
        f"Title: {r['title']}\nURL: {r['href']}\nSnippet: {r['body']}"
        for r in results
    )


def web_search(query: str, max_results: int = 3) -> str:
    """Executes a DuckDuckGo search with a 5s strict timeout."""
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_fetch_ddgs, query, max_results)
            return future.result(timeout=5)
    except TimeoutError:
        return "Search timed out."
    except Exception as e:
        return f"Search error: {str(e)}"


def _run_researcher(idea_text: str) -> str:
    """Phase 1: model plans the roadmap, fires web_search calls, synthesizes markdown."""
    messages = [
        {"role": "system", "content": RESEARCHER_PROMPT},
        {"role": "user", "content": idea_text},
    ]

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        tools=TOOLS,
        tool_choice="auto",
        parallel_tool_calls=True,
    )
    response_message = response.choices[0].message
    messages.append(response_message)

    if response_message.tool_calls:
        for tool_call in response_message.tool_calls:
            if tool_call.function.name == "web_search":
                args = json.loads(tool_call.function.arguments)
                query = args.get("query", "")
                search_results = web_search(query)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": "web_search",
                    "content": search_results,
                })

        messages.append({
            "role": "user",
            "content": "All requested searches are complete. Now synthesize everything into the final detailed text summary with the verified links.",
        })

        final_response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
        )
        return final_response.choices[0].message.content

    return response_message.content


def _run_formatter(researched_text: str) -> dict:
    """Phase 2: locks the free-text roadmap into strict schema-validated JSON."""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": FORMATTER_PROMPT},
                {"role": "user", "content": researched_text},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "roadmap", "schema": ROADMAP_SCHEMA, "strict": True},
            },
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            data = data[0]
        return data
    except Exception as e:
        # Check if Groq returned failed_generation in error response
        err_body = getattr(e, "body", {}) or {}
        failed_gen = None
        if isinstance(err_body, dict):
            failed_gen = err_body.get("error", {}).get("failed_generation")

        if not failed_gen:
            err_str = str(e)
            if "failed_generation" in err_str:
                try:
                    import re
                    match = re.search(r"['\"]failed_generation['\"]:\s*['\"](.*?)['\"]", err_str, re.DOTALL)
                    if match:
                        failed_gen = match.group(1).encode().decode('unicode_escape')
                except Exception:
                    pass

        if failed_gen:
            try:
                parsed = json.loads(failed_gen)
                if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
                    parsed = parsed[0]
                if isinstance(parsed, dict) and "idea_title" in parsed and "phases" in parsed:
                    return parsed
            except Exception:
                pass

        # Fallback request using simple json_object mode
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": FORMATTER_PROMPT + "\nReturn a single JSON object with keys 'idea_title' and 'phases'.",
                },
                {"role": "user", "content": researched_text},
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            data = data[0]
        return data


def generate_roadmap(idea_text: str) -> dict:
    """
    Full pipeline: idea text -> researched+grounded markdown -> strict JSON roadmap.
    Fault-tolerant: falls back to direct LLM synthesis if researcher/search fails.
    """
    try:
        researched_text = _run_researcher(idea_text)
    except Exception:
        researched_text = f"Idea to map into roadmap: {idea_text}"

    return _run_formatter(researched_text)