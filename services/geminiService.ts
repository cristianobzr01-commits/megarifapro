import { GoogleGenAI } from "@google/genai";

/**
 * Inicializa a instÃ¢ncia do GoogleGenAI usando a chave de API 
 * proveniente das variÃ¡veis de ambiente do Netlify (process.env.API_KEY || 'FAKE_API_KEY_FOR_DEVELOPMENT').
 */
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || 'FAKE_API_KEY_FOR_DEVELOPMENT' });

export const generateRaffleDescription = async (prizeName: string, customInstruction?: string) => {
  try {
    const basePrompt = `Escreva uma descriÃ§Ã£o empolgante e vendedora para uma rifa cujo prÃªmio principal Ã© "${prizeName}". Destaque o valor de 1 milhÃ£o de nÃºmeros e a chance de ganhar. Use emojis.`;
    const finalPrompt = customInstruction 
      ? `${basePrompt}\n\nInstruÃ§Ã£o adicional: ${customInstruction}`
      : basePrompt;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: finalPrompt,
    });
    return response.text || "DescriÃ§Ã£o nÃ£o disponÃ­vel no momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Participe da nossa grande rifa e concorra a prÃªmios incrÃ­veis! Milhares de chances de ganhar.";
  }
};

export const announceWinner = async (winnerName: string, prizeName: string, number: number) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Escreva um anÃºncio de vencedor para uma rifa. O vencedor Ã© "${winnerName}", o prÃªmio Ã© "${prizeName}" e o nÃºmero sorteado foi "${number.toString().padStart(6, '0')}". Seja festivo e use emojis!`,
    });
    return response.text || `ParabÃ©ns ao grande ganhador ${winnerName}!`;
  } catch (error) {
    console.error("Gemini Error:", error);
    return `ParabÃ©ns ao ganhador ${winnerName} com o nÃºmero ${number.toString().padStart(6, '0')}!`;
  }
};