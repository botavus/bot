require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Список каналов, из которых будем брать посты
const SOURCE_CHANNELS = process.env.SOURCE_CHANNELS.split(',');

// Файл для хранения опубликованных постов
const PUBLISHED_POSTS_FILE = path.join(__dirname, 'published_posts.json');

// Загружаем список опубликованных постов
let publishedPosts = [];
if (fs.existsSync(PUBLISHED_POSTS_FILE)) {
    publishedPosts = JSON.parse(fs.readFileSync(PUBLISHED_POSTS_FILE, 'utf-8'));
}

// Функция для удаления нежелательных элементов из текста
function cleanText(text, channel) {
    // Удаляем ссылку на канал-источник
    const channelUrlRegex = new RegExp(`https://t.me/${channel.slice(1)}`, 'g');
    // Удаляем другие нежелательные элементы
    const urlRegex = /https?:\/\/[^\s]+|ftp:\/\/[^\s]+/g; // Ссылки
    const telegramUrlRegex = /t\.me\/[^\s]+/g; // Телеграм-ссылки
    const hashtagRegex = /#[^\s]+/g; // Хэштеги
    const mentionRegex = /@[^\s]+/g; // Упоминания
    const specialCharsRegex = /[*~_]/g; // Специальные символы

    return text
        .replace(channelUrlRegex, '') // Удаляем ссылку на канал-источник
        .replace(urlRegex, '') // Удаляем ссылки
        .replace(telegramUrlRegex, '') // Удаляем телеграм-ссылки
        .replace(hashtagRegex, '') // Удаляем хэштеги
        .replace(mentionRegex, '') // Удаляем упоминания
        .replace(specialCharsRegex, '') // Удаляем специальные символы
        .trim(); // Удаляем пробелы в начале и конце
}

// Функция для получения последних постов из канала
async function getPostsFromChannel(channel) {
    try {
        console.log(`Получаем посты из канала: ${channel}`);
        const messages = await bot.telegram.getChatHistory(channel, 10);
        console.log(`Найдено сообщений: ${messages.length}`);

        const filteredMessages = messages
            .filter(msg => msg.text || msg.photo || msg.video || msg.document) // Фильтруем текстовые и медиа-сообщения
            .map(msg => ({
                ...msg,
                text: msg.text ? cleanText(msg.text, channel) : null, // Очищаем текст
                caption: msg.caption ? cleanText(msg.caption, channel) : null, // Очищаем подпись
            }))
            .filter(msg => !publishedPosts.includes(msg.text || msg.caption || msg.photo?.[0]?.file_id || msg.video?.file_id || msg.document?.file_id)); // Игнорируем уже опубликованные посты

        console.log(`Подходящих постов после фильтрации: ${filteredMessages.length}`);
        return filteredMessages;
    } catch (error) {
        console.error(`Ошибка при получении постов из канала ${channel}:`, error);
        return [];
    }
}

// Функция для публикации поста в ваш канал
async function publishToTelegram(post) {
    try {
        if (post.photo) {
            // Если пост содержит фото
            await bot.telegram.sendPhoto(
                process.env.TELEGRAM_CHANNEL_ID,
                post.photo[0].file_id, // Используем file_id первого фото
                { caption: post.caption } // Подпись к фото (если есть)
            );
            publishedPosts.push(post.photo[0].file_id); // Добавляем file_id в список опубликованных
        } else if (post.video) {
            // Если пост содержит видео
            await bot.telegram.sendVideo(
                process.env.TELEGRAM_CHANNEL_ID,
                post.video.file_id, // Используем file_id видео
                { caption: post.caption } // Подпись к видео (если есть)
            );
            publishedPosts.push(post.video.file_id); // Добавляем file_id в список опубликованных
        } else if (post.document) {
            // Если пост содержит документ
            await bot.telegram.sendDocument(
                process.env.TELEGRAM_CHANNEL_ID,
                post.document.file_id, // Используем file_id документа
                { caption: post.caption } // Подпись к документу (если есть)
            );
            publishedPosts.push(post.document.file_id); // Добавляем file_id в список опубликованных
        } else if (post.text) {
            // Если пост содержит только текст
            await bot.telegram.sendMessage(process.env.TELEGRAM_CHANNEL_ID, post.text);
            publishedPosts.push(post.text); // Добавляем текст в список опубликованных
        }
        console.log('Пост успешно опубликован в Telegram.');

        // Сохраняем обновлённый список опубликованных постов
        fs.writeFileSync(PUBLISHED_POSTS_FILE, JSON.stringify(publishedPosts, null, 2));
    } catch (error) {
        console.error('Ошибка при публикации в Telegram:', error);
    }
}

// Основная функция
async function main() {
    try {
        // Перемешиваем список каналов для случайного выбора
        const shuffledChannels = SOURCE_CHANNELS.sort(() => Math.random() - 0.5);

        // Перебираем каналы, пока не найдём подходящий пост
        for (const channel of shuffledChannels) {
            console.log(`Проверяем канал: ${channel}`);

            // Получаем посты из канала
            const posts = await getPostsFromChannel(channel);
            if (posts.length === 0) {
                console.log('Нет подходящих постов в этом канале.');
                continue; // Переходим к следующему каналу
            }

            // Выбираем случайный пост из подходящих
            const randomPost = posts[Math.floor(Math.random() * posts.length)];
            console.log('Выбран пост:', randomPost.text || randomPost.caption || 'Медиафайл');

            // Публикуем пост в ваш канал
            await publishToTelegram(randomPost);
            return; // Завершаем выполнение после успешной публикации
        }

        // Если ни в одном канале не нашлось подходящих постов
        console.log('Не найдено подходящих постов для публикации.');
        throw new Error('Ошибка при генерации контента.');
    } catch (error) {
        console.error('Ошибка в основной функции:', error);
        throw error;
    }
}

// Обработчик запросов
module.exports = async (req, res) => {
    if (req.method === 'POST') {
        try {
            await main();
            res.status(200).json({ message: 'Пост опубликован в Telegram.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else {
        res.status(405).json({ error: 'Метод не разрешен.' });
    }
};
