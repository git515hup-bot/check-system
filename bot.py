import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, ConversationHandler, CallbackQueryHandler
import yt_dlp

WAITING_FOR_URL, CHOOSING_ACTION, CHOOSING_QUALITY = range(3)
user_data = {}

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
TOKEN = "8793902275:AAE4dKr92cSoMvHWBfzXLEu5eGEUhCQTq74"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("👁 أرسل رابط يوتيوب للبدء يا سيدي.")
    return WAITING_FOR_URL

async def receive_url(update: Update, context: ContextTypes.DEFAULT_TYPE):
    url = update.message.text
    user_id = update.message.from_user.id
    msg = await update.message.reply_text("🕷 جاري جلب البيانات...")
    
    try:
        ydl_opts_info = {'quiet': True, 'no_warnings': True, 'extract_flat': False}
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info = ydl.extract_info(url, download=False)
            user_data[user_id] = {'url': url, 'title': info.get('title'), 'duration': info.get('duration')}
            title = info.get('title', 'غير معروف')
            duration = info.get('duration', 0)
            minutes, seconds = duration // 60, duration % 60
            
            keyboard = [
                [InlineKeyboardButton("🎵 تحميل صوت MP3", callback_data='audio')],
                [InlineKeyboardButton("🎬 تحميل فيديو", callback_data='video')],
                [InlineKeyboardButton("❌ إلغاء", callback_data='cancel')]
            ]
            await msg.edit_text(
                f"*✅ تم جلب البيانات*\n\n📌 *العنوان:* {title}\n⏱ *المدة:* {minutes}:{seconds:02d}\n\nاختر نوع التحميل:",
                parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard)
            )
            return CHOOSING_ACTION
    except Exception as e:
        await msg.edit_text(f"⚠️ فشل: {str(e)}")
        return ConversationHandler.END

async def choose_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    action = query.data
    
    if action == 'cancel':
        await query.edit_message_text("❌ تم الإلغاء.")
        if user_id in user_data: del user_data[user_id]
        return ConversationHandler.END
        
    if action == 'audio':
        await query.edit_message_text("🎵 جاري تحميل الصوت...")
        await download_audio(query, context, user_id)
        return ConversationHandler.END
        
    elif action == 'video':
        keyboard = [
            [InlineKeyboardButton("📱 360p", callback_data='360')],
            [InlineKeyboardButton("💻 720p", callback_data='720')],
            [InlineKeyboardButton("📺 1080p", callback_data='1080')],
            [InlineKeyboardButton("🔙 رجوع", callback_data='back')]
        ]
        await query.edit_message_text("🎬 اختر دقة الفيديو:", reply_markup=InlineKeyboardMarkup(keyboard))
        return CHOOSING_QUALITY

async def choose_quality(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    quality = query.data
    
    if quality == 'back':
        data = user_data.get(user_id, {})
        duration = data.get('duration', 0)
        minutes, seconds = duration // 60, duration % 60
        keyboard = [
            [InlineKeyboardButton("🎵 تحميل صوت MP3", callback_data='audio')],
            [InlineKeyboardButton("🎬 تحميل فيديو", callback_data='video')],
            [InlineKeyboardButton("❌ إلغاء", callback_data='cancel')]
        ]
        await query.edit_message_text(
            f"*✅ تم جلب البيانات*\n\n📌 *العنوان:* {data.get('title')}\n⏱ *المدة:* {minutes}:{seconds:02d}\n\nاختر نوع التحميل:",
            parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return CHOOSING_ACTION
    
    await query.edit_message_text(f"📥 جاري تحميل الفيديو بدقة {quality}p...")
    await download_video(query, context, user_id, quality)
    return ConversationHandler.END

async def download_audio(query, context, user_id):
    data = user_data.get(user_id)
    if not data: await query.edit_message_text("❌ انتهت الجلسة."); return
    url, title = data['url'], data['title']
    try:
        audio_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'}],
            'outtmpl': f'{title}.%(ext)s', 'quiet': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        with yt_dlp.YoutubeDL(audio_opts) as ydl:
            ydl.download([url])
        for file in os.listdir('.'):
            if file.endswith('.mp3') and title[:20] in file:
                with open(file, 'rb') as f:
                    await context.bot.send_audio(chat_id=query.message.chat_id, audio=f, title=title, performer="YouTube")
                os.remove(file)
                await query.edit_message_text("✅ تم إرسال الصوت بنجاح.")
                break
    except Exception as e:
        await query.edit_message_text(f"⚠️ فشل تحميل الصوت: {str(e)}")
    finally:
        if user_id in user_data: del user_data[user_id]

async def download_video(query, context, user_id, quality):
    data = user_data.get(user_id)
    if not data: await query.edit_message_text("❌ انتهت الجلسة."); return
    url, title = data['url'], data['title']
    try:
        format_str = f'bestvideo[height<={quality}]+bestaudio/best[height<={quality}]'
        ydl_opts = {
            'format': format_str, 'outtmpl': f'{title}.%(ext)s', 'restrictfilenames': True,
            'noplaylist': True, 'quiet': True, 'merge_output_format': 'mp4',
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        for file in os.listdir('.'):
            if file.endswith(('.mp4', '.mkv', '.webm')) and title[:20] in file:
                if not file.endswith('.mp4'):
                    new_file = file.rsplit('.', 1)[0] + '.mp4'
                    os.rename(file, new_file)
                    file = new_file
                with open(file, 'rb') as f:
                    await context.bot.send_video(chat_id=query.message.chat_id, video=f, caption=f"🎬 {title} ({quality}p)", supports_streaming=True)
                os.remove(file)
                await query.edit_message_text("✅ تم إرسال الفيديو بنجاح.")
                break
    except Exception as e:
        await query.edit_message_text(f"⚠️ فشل تحميل الفيديو: {str(e)}")
    finally:
        if user_id in user_data: del user_data[user_id]

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("❌ تم الإلغاء.")
    return ConversationHandler.END

def main():
    app = Application.builder().token(TOKEN).build()
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('start', start)],
        states={
            WAITING_FOR_URL: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_url)],
            CHOOSING_ACTION: [CallbackQueryHandler(choose_action, pattern='^(video|audio|cancel)$')],
            CHOOSING_QUALITY: [CallbackQueryHandler(choose_quality, pattern='^(360|720|1080|back)$')],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
    )
    app.add_handler(conv_handler)
    print("👹 WORM MODE V99: البوت يعمل...")
    app.run_polling()

if __name__ == '__main__':
    main()

