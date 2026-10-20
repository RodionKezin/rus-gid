export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Разрешён только POST-запрос"
    });
  }

  try {
    const { messages } = request.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return response.status(400).json({
        error: "Сообщения не переданы"
      });
    }

    const safeMessages = messages
      .filter((message) => {
        return (
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.text === "string" &&
          message.text.trim()
        );
      })
      .slice(-12)
      .map((message) => ({
        role: message.role,
        text: message.text.trim().slice(0, 2000)
      }));

    if (!safeMessages.length) {
      return response.status(400).json({
        error: "Нет корректных сообщений"
      });
    }

    const yandexMessages = [
      {
        role: "system",
        text: [
          "Ты — Рус Гид, дружелюбный консультант по путешествиям по России.",
          "Отвечай на русском языке.",
          "Помогай выбирать города, музеи, кафе, природу и маршруты.",
          "Пиши понятно и кратко.",
          "Не выдумывай точные цены, расписания и наличие мест.",
          "Если актуальные данные неизвестны, честно скажи об этом."
        ].join(" ")
      },
      ...safeMessages
    ];

    const yandexResponse = await fetch(
      "https://ai.api.cloud.yandex.net/foundationModels/v1/completion",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Api-Key ${process.env.YANDEX_API_KEY}`
        },
        body: JSON.stringify({
          modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt/latest`,
          completionOptions: {
            stream: false,
            temperature: 0.6,
            maxTokens: 700
          },
          messages: yandexMessages
        })
      }
    );

    const data = await yandexResponse.json();

    if (!yandexResponse.ok) {
      console.error("Yandex API error:", data);

      return response.status(502).json({
        error: "Не удалось получить ответ от ИИ"
      });
    }

    const answer =
      data.result?.alternatives?.[0]?.message?.text ||
      data.result?.alternatives?.[0]?.text;

    if (!answer) {
      return response.status(502).json({
        error: "ИИ вернул пустой ответ"
      });
    }

    return response.status(200).json({
      answer
    });
  } catch (error) {
    console.error("Server error:", error);

    return response.status(500).json({
      error: "Внутренняя ошибка сервера"
    });
  }
}
