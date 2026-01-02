import { GoogleGenAI } from "@google/genai";

/**
 * Inicializa a instância do GoogleGenAI usando a chave de API 
 * proveniente das variáveis de ambiente do Netlify (process.env.API_KEY).
 */
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateRaffleDescription = async (prizeName: string, customInstruction?: string) => {
  try {
    const basePrompt = `Escreva uma descrição empolgante e vendedora para uma rifa cujo prêmio principal é "${prizeName}". Destaque o valor de 1 milhão de números e a chance de ganhar. Use emojis.`;
    const finalPrompt = customInstruction 
      ? `${basePrompt}\n\nInstrução adicional: ${customInstruction}`
      : basePrompt;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: finalPrompt,
    });
    return response.text || "Descrição não disponível no momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Participe da nossa grande rifa e concorra a prêmios incríveis! Milhares de chances de ganhar.";
  }
};

export const announceWinner = async (winnerName: string, prizeName: string, number: number) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Escreva um anúncio de vencedor para uma rifa. O vencedor é "${winnerName}", o prêmio é "${prizeName}" e o número sorteado foi "${number.toString().padStart(6, '0')}". Seja festivo e use emojis!`,
    });
    return response.text || `Parabéns ao grande ganhador ${winnerName}!`;
  } catch (error) {
    console.error("Gemini Error:", error);
    return `Parabéns ao ganhador ${winnerName} com o número ${number.toString().padStart(6, '0')}!`;
  }
};