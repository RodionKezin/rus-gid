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

    const apiKey = process.env.YANDEX_API_KEY;
    const folderId = process.env.YANDEX_FOLDER_ID;

    if (!apiKey || !folderId) {
      console.error("Не найдены YANDEX_API_KEY или YANDEX_FOLDER_ID");

      return response.status(500).json({
        error: "Переменные Yandex Cloud не настроены"
      });
    }

    const safeMessages = messages
      .filter((message) => {
        return (
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.text === "string" &&
          message.text.trim()
        );
      })
      .slice(-12);

    const result = await fetch(
      "https://ai.api.cloud.yandex.net/foundationModels/v1/completion",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Api-Key ${apiKey}`
        },
        body: JSON.stringify({
          modelUri: `gpt://${folderId}/yandexgpt/latest`,
          completionOptions: {
            stream: false,
            temperature: 0.6,
            maxTokens: "700"
          },
          messages: [
            {
              role: "system",
              text: "Ты — Рус Гид, дружелюбный консультант по путешествиям по России. Отвечай на русском языке. Помогай выбирать города, достопримечательности и маршруты. Не выдумывай точные цены и расписания."
            },
            ...safeMessages
          ]
        })
      }
    );

    const data = await result.json();

    if (!result.ok) {
      console.error("Yandex error:", result.status, data);

      return response.status(502).json({
        error: "YandexGPT вернул ошибку"
      });
    }

    const answer = data.alternatives?.[0]?.message?.text;

    if (!answer) {
      console.error("Пустой ответ YandexGPT:", data);

      return response.status(502).json({
        error: "YandexGPT вернул пустой ответ"
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


