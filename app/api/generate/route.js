import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `You are a study flashcard creator.
These flashcards should be clear, concise, and cover key points of the subject matter. 
Provide both questions and answers, and ensure that the content is accurate and well-organized.
Automatically generate flashcards based on the provided input, ensuring each flashcard has a question on one side and an answer on the other.
If you don't understand the input or need more information, just respond with "I need more information."
Always generate 6 flashcards.
Always return your response in the following strict JSON format without any additional text or commentary:
{ 
  "flashcards" : [{
    "front": "str",
    "back": "str"
  }]
}`;

export async function POST(req) {
  try {
    const data = await req.text();

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: data },
      ],
    });

    console.log(completion.choices[0].message.content);

    const messageContent = completion.choices[0].message.content;
    if (messageContent === "I need more information.") {
      return NextResponse.json({ error: "I need more information." });
    }

    const jsonStartIndex = messageContent.indexOf("{");
    const jsonString = messageContent.slice(jsonStartIndex);

    try {
      const flashcards = JSON.parse(jsonString);

      return NextResponse.json(flashcards.flashcards);
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return NextResponse.json(
        { error: "Failed to parse flashcards JSON" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to generate flashcards:", error);
    return NextResponse.json(
      { error: "Failed to generate flashcards: ", error },
      { status: 500 }
    );
  }
}
