console.log("GEMINI VERSION 2026");
export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Разрешён только POST-запрос"
    });
  }

  try {
    const { messages } = request.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return response.status(500).json({
        error: "В Vercel не найден GEMINI_API_KEY"
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return response.status(400).json({
        error: "Сообщения не переданы"
      });
    }

    const contents = [
      {
        role: "user",
        parts: [
          {
            text:
              "Ты — Рус Гид, дружелюбный консультант по путешествиям по России. " +
              "Отвечай на русском языке. Помогай выбирать города, " +
              "достопримечательности, кафе и маршруты. " +
              "Не выдумывай точные цены и расписания."
          }
        ]
      },
      ...messages
        .filter((message) => {
          return (
            message &&
            typeof message.text === "string" &&
            message.text.trim() &&
            ["user", "assistant"].includes(message.role)
          );
        })
        .slice(-12)
        .map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [
            {
              text: message.text
            }
          ]
        }))
    ];

    const result = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 700
          }
        })
      }
    );

    const data = await result.json();

    if (!result.ok) {
      console.error("Gemini error:", result.status, data);

      return response.status(502).json({
        error: "Gemini вернул ошибку"
      });
    }

    const answer =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!answer) {
      console.error("Gemini returned empty answer:", data);

      return response.status(502).json({
        error: "Gemini вернул пустой ответ"
      });
    }

    return response.status(200).json({ answer });
  } catch (error) {
    console.error("Chat error:", error);

    return response.status(500).json({
      error: "Ошибка серверной функции"
    });
  }
}
