export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST is allowed" });
  }

  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;

  if (!apiKey || !folderId) {
    console.error("Missing YANDEX_API_KEY or YANDEX_FOLDER_ID");

    return res.status(500).json({
      error: "Переменные Yandex Cloud не найдены"
    });
  }

  try {
    const body = req.body || {};
    const incomingMessages = Array.isArray(body.messages)
      ? body.messages
      : [];

    const messages = incomingMessages
      .filter((message) => {
        return (
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.text === "string" &&
          message.text.trim()
        );
      })
      .slice(-10)
      .map((message) => ({
        role: message.role,
        text: message.text.trim()
      }));

    if (messages.length === 0) {
      return res.status(400).json({
        error: "Сообщение отсутствует"
      });
    }

    const yandexResponse = await fetch(
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
              text: "Ты — Рус Гид, дружелюбный консультант по путешествиям по России. Отвечай на русском языке. Помогай выбирать города, достопримечательности и маршруты. Отвечай понятно и не выдумывай точные цены и расписания."
            },
            ...messages
          ]
        })
      }
    );

    const data = await yandexResponse.json();

    if (!yandexResponse.ok) {
      console.error("Yandex status:", yandexResponse.status);
      console.error("Yandex response:", data);

      return res.status(502).json({
        error: "Ошибка YandexGPT",
        status: yandexResponse.status
      });
    }

    const answer =
      data.result?.alternatives?.[0]?.message?.text;

    if (!answer) {
      console.error("Unexpected Yandex response:", data);

      return res.status(502).json({
        error: "YandexGPT не вернул текст"
      });
    }

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("Function error:", error);

    return res.status(500).json({
      error: "Ошибка серверной функции"
    });
  }
}
