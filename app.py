# app.py
from flask import Flask, render_template, request, redirect, url_for
import json
import openai
import requests
import os
from telegram import Bot
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv

app = Flask(__name__)
load_dotenv()

# Загрузка конфигурации из .env
openai.api_key = os.getenv("OPENAI_API_KEY")
telegram_token = os.getenv("TELEGRAM_TOKEN")
channel_username = os.getenv("CHANNEL_USERNAME")
unsplash_access_key = os.getenv("UNSPLASH_ACCESS_KEY")
post_times = json.loads(os.getenv("POST_TIMES", '["08:00", "12:00", "14:00", "18:00", "21:00"]'))
default_topic = os.getenv("DEFAULT_TOPIC", "Тема дня")

bot = Bot(token=telegram_token)
scheduler = BackgroundScheduler()

def get_content_from_gpt(topic):
    response = openai.Completion.create(
        model="text-davinci-003",
        prompt=f"Напиши статью на тему: {topic}",
        max_tokens=1000
    )
    return response.choices[0].text.strip()

def get_image_from_unsplash(query):
    url = f"https://api.unsplash.com/photos/random?query={query}&client_id={unsplash_access_key}"
    response = requests.get(url)
    return response.json().get('urls', {}).get('regular', '')

def adjust_text_length(text):
    if len(text) < 500:
        text += " (добавлено для достижения 500 символов)"
    elif len(text) > 3000:
        text = text[:2997] + "..."
    return text

def post_to_channel_with_image(content, image_url):
    bot.send_message(chat_id=channel_username, text=content)
    if image_url:
        bot.send_photo(chat_id=channel_username, photo=image_url)

def scheduled_post():
    content = get_content_from_gpt(default_topic)
    content = adjust_text_length(content)
    image_url = get_image_from_unsplash(default_topic)
    post_to_channel_with_image(content, image_url)

for time_str in post_times:
    hour, minute = map(int, time_str.split(':'))
    trigger = CronTrigger(hour=hour, minute=minute)
    scheduler.add_job(scheduled_post, trigger)

scheduler.start()

@app.route('/admin', methods=['GET', 'POST'])
def admin_panel():
    if request.method == 'POST':
        new_topic = request.form['topic']
        new_times = request.form.getlist('post_times')
        global default_topic, post_times
        default_topic = new_topic
        post_times = new_times
        os.environ['DEFAULT_TOPIC'] = new_topic
        os.environ['POST_TIMES'] = json.dumps(new_times)
        return redirect(url_for('admin_panel'))
    return render_template('admin.html', topic=default_topic, post_times=post_times)

if __name__ == '__main__':
    app.run(debug=True)
