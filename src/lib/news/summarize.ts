import Groq from "groq-sdk";

const MAX_INPUT_CHARS = 8000;

function truncate(text: string): string {
  return text.length > MAX_INPUT_CHARS
    ? `${text.slice(0, MAX_INPUT_CHARS)}…`
    : text;
}

export async function summarizeArticle(
  title: string,
  fullText: string
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You summarize news articles. Write a concise, neutral 2-3 " +
            "sentence summary of the article's key facts. Output ONLY the " +
            "summary text — no preamble, no labels, no quotes.",
        },
        {
          role: "user",
          content: `Title: ${title}\n\nArticle:\n${truncate(fullText)}`,
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    return summary || null;
  } catch (error) {
    console.error("Summarization error:", error);
    return null;
  }
}
