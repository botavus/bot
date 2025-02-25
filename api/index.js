require('dotenv').config();
const axios = require('axios');
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

async function generateContent() {
    try {
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/gpt2', // Используем GPT-2
            {
                inputs: "Напиши интересный пост для Telegram-канала.",
                parameters: {
                    max_length: 100, // Ограничение длины текста
                    temperature: 0.7, // Креативность
                },
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data[0].generated_text;
    } catch (error) {
        console.error('Ошибка при запросе к Hugging Face:', error);
        return null;
    }
}

async function publishToTelegram(content) {
    try {
        await bot.telegram.sendMessage(process.env.TELEGRAM_CHANNEL_ID, content);
        console.log('Контент успешно опубликован в Telegram.');
    } catch (error) {
        console.error('Ошибка при публикации в Telegram:', error);
    }
}

module.exports = async (req, res) => {
    if (req.method === 'POST') {
        const content = await generateContent();
        if (content) {
            await publishToTelegram(content);
            res.status(200).json({ message: 'Контент опубликован в Telegram.' });
        } else {
            res.status(500).json({ error: 'Ошибка при генерации контента.' });
        }
    } else {
        res.status(405).json({ error: 'Метод не разрешен.' });
    }
};