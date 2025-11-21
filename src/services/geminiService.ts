import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const generateGameCommentary = async (
  action: 'kill' | 'win' | 'screen_change',
  playerColor: string
): Promise<string> => {
  if (!ai) return "THE SERPENT WATCHES...";

  let prompt = "";
  
  if (action === 'kill') {
    prompt = `A pixelated sword fighter (${playerColor}) just brutally slew their opponent in a Nidhogg-style fencing game. Write a ONE or TWO word arcade-style hype reaction. Examples: "OBLITERATED!", "SKEWERED!", "HEADSHOT!", "DOMINATED!". Return ONLY the word(s).`;
  } else if (action === 'screen_change') {
    prompt = `The fighter in ${playerColor} is sprinting to the next screen! Write a max 3-word command like "GO! GO! GO!" or "PUSH FORWARD!".`;
  } else if (action === 'win') {
    prompt = `The warrior in ${playerColor} has been devoured by the Nidhogg (a giant serpent), which is the ultimate victory. Write a cryptic, heavy metal, mythic sentence celebrating their sacrifice.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text?.trim() || "WITNESS!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "BLOOD FOR THE SERPENT.";
  }
};
