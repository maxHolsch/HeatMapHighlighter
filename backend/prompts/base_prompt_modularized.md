I am going to give you a transcript of a conversation. It may have been generated using an automatic speech recognition model, and therefore there may be some errors.

The transcript is split up into paragraphs. Each paragraph will be formatted in a way that contains various metadata, including its index (order) in the overall transcript and the speaker's name.

The format for each paragraph will be as follows:

<paragraph>
<index> {{index}} </index>
<speaker> {{name}} </speaker>
<text> {{transcript}} </text>
</paragraph>

Your task is to determine whether each paragraph in the conversation contains content that may be considered a "highlight". A highlight is defined as follows:

{highlight_definition}

**Ignore any portions of the conversation (often at the beginning and end) which contain only instructions and logistical details.**

{conversation_context}

{theme_conditioning_instructions}

For each paragraph, return an integer score between 0 and 10 that rates the semantic or emotional significance of any content in the paragraph. Your score should reflect the degree to which meaningful or powerful content exists in a given paragraph, and not necessarily the proportion of a paragraph that may be relevant. For example, a paragraph where half of the content discusses a particularly powerful or emotional story should receive a higher score than one that tells a more shallow story throughout the entire paragraph.

A story or experience may also span multiple consecutive paragraphs that were spoken by the same person. If this happens, you should score all paragraphs in such a span utilizing prior or subsequent context as necessary.

Use the following scale as rough guidance when determining scores:

0-1: The paragraph only contains content that is either purely logistical (e.g., introductions and instructions) or has little to no substance.

2-4: The paragraph contains some potentially substantive content, but is clinical, brief, or lacks personal investment.

5-7: The paragraph provides a clear opinion, story, or observation. It adds some value to the conversation but may lack expressiveness or emotional resonance.

8-10: Contains a clear personal narrative, a specific life experience, a thoughtful analysis, or other deeply noteworthy content. Often delivered with high expressiveness or emotional resonance.

Briefly do some reasoning to determine whether the content in the paragraph is relevant or noteworthy given the above definition of a "highlight" and the rubric that was provided, considering how emotionally resonant or powerful that content is. Provide your output in the following JSON object format, where the "score" is an integer between 0 and 10, and you provide an output for each paragraph in the formatted transcript. Make sure that all "score" values are between 0 and 10, and that you produce an output for every paragraph! (For example, if there are 100 paragraphs in the transcript, you should output 100 scores.)

{{
    {{
        "paragraph_index": 0,
        "reasoning": <1 or 2 sentences describing the reasoning for the score>,
        "score": <integer score between 0 - 10>
    }},
    {{
        "paragraph_index": 1,
        "reasoning": <1 or 2 sentences describing the reasoning for the score>,
        "score": <integer score between 0 - 10>
    }},
    ...
}}

Provide your output as a JSON list of objects. It is critical that you do not skip any paragraphs. Even if a paragraph receives a score of 0, it must be included in the JSON output to maintain a 1:1 mapping with the input. There are {num_paragraphs} paragraphs in this transcript, so your output JSON list should contain {num_paragraphs} entries.

Here is the full formatted transcript of the conversation that I would like you to evaluate:
