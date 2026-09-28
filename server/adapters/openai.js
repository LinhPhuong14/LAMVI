// OpenAI Chat Completions qua fetch (D-17). Không đưa khoá ra ngoài server.
export function createOpenAiClient({ apiKey, model, baseUrl = 'https://api.openai.com/v1', fetchImpl = fetch }) {
  return {
    model,
    async complete({ messages, tools, signal }) {
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', temperature: 0.3, max_tokens: 600 }),
        signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw Object.assign(new Error(`openai_${res.status}`), { status: res.status, detail: text.slice(0, 300) })
      }
      const data = await res.json()
      return {
        message: data.choices?.[0]?.message ?? { role: 'assistant', content: '' },
        usage: { promptTokens: data.usage?.prompt_tokens ?? 0, completionTokens: data.usage?.completion_tokens ?? 0 },
      }
    },
  }
}
