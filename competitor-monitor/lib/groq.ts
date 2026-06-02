import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function generateInsight(prompt: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          'You are a competitive intelligence analyst for digital marketing agencies in India. ' +
          'Analyse competitor website changes and provide concise, actionable insights in 2-4 sentences. ' +
          'Focus on business impact, SEO implications, and strategic intent. ' +
          'Be direct and specific — no filler phrases.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 512,
  })

  return completion.choices[0]?.message?.content ?? ''
}
