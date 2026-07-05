import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";

const MAX_CHARS = 6000; // keeps a single request comfortably within model context

function truncate(text: string): string {
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;
}

// Translates article text to English via Groq's free-tier LLM API. Replaces
// an earlier version that called Google's undocumented translate_a/single
// endpoint — that endpoint has no key/ToS guarantee and can be rate-limited
// or blocked without notice. Groq is a real, keyed API we already hold a
// free-tier key for (see .env), so this is the more durable choice.
export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Translation is not configured." },
      { status: 503 }
    );
  }

  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!text || typeof text !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid `text`." },
      { status: 400 }
    );
  }

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a translation engine, not a chat assistant. Translate the " +
            "user's news article text into natural, fluent English and output " +
            "ONLY the translated text, preserving the original paragraph breaks. " +
            "Never add commentary, notes, disclaimers, or wrap the output in " +
            "quotes. Never comment on whether translation was needed. If the " +
            "input is already English, output it verbatim, unchanged.",
        },
        { role: "user", content: truncate(text) },
      ],
    });

    const translatedText = completion.choices[0]?.message?.content?.trim();
    if (!translatedText) {
      throw new Error("Empty translation response");
    }

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Failed to translate text." },
      { status: 502 }
    );
  }
}
