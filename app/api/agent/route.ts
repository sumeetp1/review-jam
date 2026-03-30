import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini API Brain
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { reviewContent, reviewerName } = await req.json();

    if (!reviewContent) {
      return NextResponse.json({ error: "Review content is required" }, { status: 400 });
    }

    // We use gemini-1.5-flash because it is lightning fast and perfect for JSON tasks
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      // Forcing the AI to return clean JSON
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // The Ruthless System Prompt
    const systemInstruction = `
    You are a ruthless, highly strict Quality Control Agent for a product review platform. Your job is to analyze incoming reviews and filter out spam.

    You MUST return a JSON object with this exact structure:
    {
      "isGenuine": boolean,
      "reason": "string",
      "marketingQuote": "string"
    }

    RULES FOR REJECTION (Set isGenuine to false):
    1. If the text contains keyboard mashing (e.g., "asdfg", "qwerty").
    2. If the user explicitly states it is a test, fake, dummy, or trial review.
    3. If the review is less than 3 words long.
    4. If the text is completely unrelated to evaluating a product or service.

    If rejected, provide a stern "reason" (e.g., "Review contains keyboard mashing and lacks genuine feedback.") and leave the marketingQuote empty.
    If accepted, set isGenuine to true, leave reason empty, and extract a compelling 5-10 word "marketingQuote" from their text.
    `;

    // Constructing the final prompt
    const prompt = `
    ${systemInstruction}
    
    Reviewer Name: ${reviewerName || "Anonymous"}
    Review Content: "${reviewContent}"
    
    Analyze this review and return the JSON.
    `;

    // Wake up the AI and get the response
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse the AI's string into an actual JSON object
    const analysis = JSON.parse(responseText);

    // Send it back to the frontend!
    return NextResponse.json({ success: true, analysis });

  } catch (error) {
    console.error("AI Agent Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to process review with AI." 
    }, { status: 500 });
  }
}