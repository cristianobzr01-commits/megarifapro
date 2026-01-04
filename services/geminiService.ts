import { GoogleGenAI } from "@google/genai";

/**
 * Inicializa a instÃÂ¢ncia do GoogleGenAI usando a chave de API 
 * proveniente das variÃÂ¡veis de ambiente do Netlify (process.env.API_KEY || 'FAKE_API_KEY_FOR_DEVELOPMENT').
 */
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || 'FAKE_API_KEY_FOR_DEVELOPMENT' });

export const generateRaffleDescription = async (prizeName: string, customInstruction?: string) => {
  try {
    const basePrompt = `Escreva uma descriÃÂ§ÃÂ£o empolgante e vendedora para uma rifa cujo prÃÂªmio principal ÃÂ© "${prizeName}". Destaque o valor de 1 milhÃÂ£o de nÃÂºmeros e a chance de ganhar. Use emojis.`;
    const finalPrompt = customInstruction 
      ? `${basePrompt}\n\nInstruÃÂ§ÃÂ£o adicional: ${customInstruction}`
      : basePrompt;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: finalPrompt,
    });
    return response.text || "DescriÃÂ§ÃÂ£o nÃÂ£o disponÃÂ­vel no momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Participe da nossa grande rifa e concorra a prÃÂªmios incrÃÂ­veis! Milhares de chances de ganhar.";
  }
};

export const announceWinner = async (winnerName: string, prizeName: string, number: number) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Escreva um anÃÂºncio de vencedor para uma rifa. O vencedor ÃÂ© "${winnerName}", o prÃÂªmio ÃÂ© "${prizeName}" e o nÃÂºmero sorteado foi "${number.toString().padStart(6, '0')}". Seja festivo e use emojis!`,
    });
    return response.text || `ParabÃÂ©ns ao grande ganhador ${winnerName}!`;
  } catch (error) {
    console.error("Gemini Error:", error);
    return `ParabÃÂ©ns ao ganhador ${winnerName} com o nÃÂºmero ${number.toString().padStart(6, '0')}!`;
  }
};