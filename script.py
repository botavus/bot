import os
import time
import requests
import schedule
import random

# 🔹 ДАННЫЕ ДЛЯ БОТА (загружаются из переменных окружения)
BOT_TOKEN = os.getenv("6358415579:AAHQMEZ1vpBsTTpL1Vu2nddHFco5XUmq_Q0")
DESTINATION_CHANNEL = os.getenv("@poparto")

# 🔹 СПИСОК КАНАЛОВ-ИСТОЧНИКОВ (можно менять в коде)
SOURCE_CHANNELS = [
    "@UaOnliil2",
    "@vanek_nikolaev",
    "@truexanewsua"
]

# URL API Telegram
API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

def get_last_message(channel):
    """Получает последнее сообщение из указанного канала"""
    url = f"{API_URL}/getUpdates"
    response = requests.get(url).json()

    if response.get("result"):
        for update in response["result"]:
            if "channel_post" in update:
                post = update["channel_post"]
                if post["chat"]["username"] == channel.replace("@", ""):
                    return post
    return None

def contains_unwanted_links(text, channel):
    """Проверяет, есть ли в тексте нежелательные ссылки"""
    forbidden_links = ["http://", "https://", "t.me/", "bit.ly", "goo.gl"]
    allowed_link = f"t.me/{channel.replace('@', '')}"  # Разрешенная ссылка на сам канал

    for link in forbidden_links:
        if link in text and allowed_link not in text:
            return True
    return False

def forward_random_post():
    """Выбирает случайный канал, проверяет пост и пересылает его"""
    random.shuffle(SOURCE_CHANNELS)  # Перемешиваем список каналов

    for channel in SOURCE_CHANNELS:
        message = get_last_message(channel)
        if message and "text" in message:
            text = message["text"]

            if not contains_unwanted_links(text, channel):  # Проверяем на нежелательные ссылки
                url = f"{API_URL}/forwardMessage"
                data = {
                    "chat_id": DESTINATION_CHANNEL,
                    "from_chat_id": channel,
                    "message_id": message["message_id"]
                }
                requests.post(url, data=data)
                print(f"✅ Переслано сообщение из {channel}")
                return

    print("⚠️ Не найдено подходящих постов.")

def schedule_random_posts():
    """Запускает публикацию 5 раз в сутки в случайное время"""
    for _ in range(5):
        hour = random.randint(6, 23)  # Часы (с 6 утра до 23 вечера)
        minute = random.randint(0, 59)  # Минуты
        schedule.every().day.at(f"{hour:02}:{minute:02}").do(forward_random_post)
        print(f"📅 Запланирован пост на {hour:02}:{minute:02}")

# Запускаем расписание
schedule_random_posts()

while True:
    schedule.run_pending()
    time.sleep(60)  # Проверка каждую минуту
