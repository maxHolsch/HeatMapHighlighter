"""
Assemble the full LLM prompt from a user-provided template and merged snippets.
"""

from typing import Dict, List

from config import MODULAR_PROMPT_TEMPLATE, THEME_CONDITIONING_TEMPLATE


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


def _assemble_modular_template(
    highlight_definition: str,
    conversation_context: str,
    theme_conditioning: str,
) -> str:
    """Fill the modular prompt template with user-provided sections."""
    template = MODULAR_PROMPT_TEMPLATE
    template = template.replace("{highlight_definition}", highlight_definition)
    template = template.replace("{conversation_context}", conversation_context)

    if theme_conditioning and theme_conditioning.strip():
        theme_block = THEME_CONDITIONING_TEMPLATE.replace(
            "{theme_description}", theme_conditioning.strip()
        )
    else:
        theme_block = ""

    template = template.replace("{theme_conditioning_instructions}", theme_block)
    return template


def build_modular_prompt(
    highlight_definition: str,
    conversation_context: str,
    theme_conditioning: str,
    merged_snippets: List[Dict],
) -> str:
    """Build the full prompt from modular user-editable components."""
    template = _assemble_modular_template(
        highlight_definition, conversation_context, theme_conditioning,
    )
    return build_full_prompt(template, merged_snippets)


def build_modular_preview_prompt(
    highlight_definition: str,
    conversation_context: str,
    theme_conditioning: str,
    merged_snippets: List[Dict],
    preview_count: int = 10,
) -> str:
    """Build a truncated modular prompt for preview."""
    template = _assemble_modular_template(
        highlight_definition, conversation_context, theme_conditioning,
    )
    return build_preview_prompt(template, merged_snippets, preview_count)
