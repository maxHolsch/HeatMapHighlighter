"""
Natural-language query -> (style, topic) decomposition via Claude tool-use.

Returns a dict:
    {"style": "frustrated tone", "topic": "housing", "rationale": "..."}
Either field may be the empty string if the user's query doesn't address it.
"""

from __future__ import annotations

from typing import Dict

from config import ANTHROPIC_PLANNER_MODEL
from llm_client import run_structured

PLANNER_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "style": {
            "type": "string",
            "description": (
                "Short phrase describing the paralinguistic/speaking-style "
                "aspect of the query (e.g. 'frustrated tone', 'laughing', "
                "'solemn'). Empty string if the query does not describe a "
                "speaking style."
            ),
        },
        "topic": {
            "type": "string",
            "description": (
                "Short phrase describing the topical/content aspect of the "
                "query (e.g. 'housing', 'growing up in Boston'). Empty "
                "string if the query is purely about speaking style."
            ),
        },
        "rationale": {
            "type": "string",
            "description": "One sentence explaining the decomposition.",
        },
    },
    "required": ["style", "topic", "rationale"],
}


SYSTEM = (
    "You decompose a user's natural-language conversation-search query into "
    "two independent axes: paralinguistic SPEAKING STYLE (how something is "
    "said) and TOPICAL CONTENT (what is being talked about). Either axis "
    "can be empty. Keep both phrases short and retrieval-friendly."
)


def plan(query: str) -> Dict[str, str]:
    result = run_structured(
        model=ANTHROPIC_PLANNER_MODEL,
        prompt=f"Query: {query}\n\nDecompose this into style and topic.",
        system=SYSTEM,
        tool_name="record_query_plan",
        tool_description="Record the style/topic decomposition of the query.",
        input_schema=PLANNER_TOOL_SCHEMA,
        max_tokens=512,
    )
    return {
        "style": result.get("style", "").strip(),
        "topic": result.get("topic", "").strip(),
        "rationale": result.get("rationale", "").strip(),
    }
