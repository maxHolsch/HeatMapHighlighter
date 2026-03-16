"""
Assemble the full LLM prompt from a user-provided template and merged snippets.
"""

from typing import Dict, List


def format_snippets_text_only(merged_snippets: List[Dict]) -> str:
    """Format merged snippets into the XML paragraph structure expected by the LLM."""
    paragraphs = []
    for i, snippet in enumerate(merged_snippets):
        paragraph = (
            f"<paragraph>\n"
            f"<index> {i} </index>\n"
            f"<speaker> {snippet['speaker_name']} </speaker>\n"
            f"<text> {snippet['transcript']} </text>\n"
            f"</paragraph>"
        )
        paragraphs.append(paragraph)
    return "\n\n".join(paragraphs)


def build_full_prompt(
    prompt_template: str,
    merged_snippets: List[Dict],
) -> str:
    """
    Fill {num_paragraphs} in the template and append the formatted transcript.

    The user is responsible for embedding any codebook text directly in
    their prompt template (via the UI editor).
    """
    num_paragraphs = len(merged_snippets)
    formatted_transcript = format_snippets_text_only(merged_snippets)

    filled = prompt_template.replace(
        "{num_paragraphs}", str(num_paragraphs)
    )

    return filled + "\n\n" + formatted_transcript


def build_preview_prompt(
    prompt_template: str,
    merged_snippets: List[Dict],
    preview_count: int = 10,
) -> str:
    """
    Build a truncated version of the prompt showing only the first
    *preview_count* formatted snippets, for user review before the LLM call.
    """
    num_paragraphs = len(merged_snippets)
    preview_snippets = merged_snippets[:preview_count]
    formatted_preview = format_snippets_text_only(preview_snippets)

    filled = prompt_template.replace(
        "{num_paragraphs}", str(num_paragraphs)
    )

    truncation_note = ""
    if len(merged_snippets) > preview_count:
        remaining = len(merged_snippets) - preview_count
        truncation_note = (
            f"\n\n... ({remaining} more paragraphs omitted from preview) ..."
        )

    return filled + "\n\n" + formatted_preview + truncation_note
