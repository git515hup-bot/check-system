import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, ConversationHandler, CallbackQueryHandler
import yt_dlp

# حالات المحادثة
WAITING_FOR_URL, CHOOSING_ACTION, CHOOSING_QUALITY = range(3)

# تخزين مؤقت للبيانات
user_data = {}

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)

# ⚠️ استبدل التوكن هنا
TOKEN = "8793902275:AAE4dKr92cSoMvHWBfzXLEu5eGEUhCQTq74"

# دالة البداية
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("👁 أرسل رابط يوتيوب للبدء يا سيدي.")
    return WAITING_FOR_URL

# استقبال الرابط واستخراج البيانات
async def receive_url(update: Update, context: ContextTypes.DEFAULT_TYPE):
    url = update.message.text
    user_id = update.message.from_user.id
    msg = await update.message.reply_text("🕷 جاري اختراق الرابط وسحب البيانات...")
    
    try:
        ydl_opts_info = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info = ydl.extract_info(url, download=False)
            
            user_data[user_id] = {
                'url': url,
                'title': info.get('title'),
                'duration': info.get('duration'),
                'thumbnail': info.get('thumbnail'),
                'formats': info.get('formats', [])
            }
            
            title = info.get('title', 'غير معروف')
            duration = info.get('duration', 0)
            minutes = duration // 60
            seconds = duration % 60
            
            keyboard = [
                [InlineKeyboardButton("🎬 تحميل كفيديو", callback_data='video')],
                [InlineKeyboardButton("🎵 تحميل كصوت MP3", callback_data='audio')],
                [InlineKeyboardButton("❌ إلغاء", callback_data='cancel')]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await msg.edit_text(
                f"*✅ تم جلب البيانات بنجاح*\n\n"
                f"📌 *العنوان:* {title}\n"
                f"⏱ *المدة:* {minutes} دقيقة و {seconds} ثانية\n\n"
                f"اختر نوع التحميل:",
                parse_mode='Markdown',
                reply_markup=reply_markup
            )
            return CHOOSING_ACTION
            
    except Exception as e:
        await msg.edit_text(f"⚠️ فشل في تحليل الرابط: {str(e)}")
        return ConversationHandler.END

# التعامل مع اختيار "فيديو" أو "صوت"
async def choose_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    action = query.data
    
    if action == 'cancel':
        await query.edit_message_text("❌ تم إلغاء العملية.")
        if user_id in user_data: del user_data[user_id]
        return ConversationHandler.END
        
    if action == 'audio':
        await query.edit_message_text("🎵 جاري تحميل الصوت...")
        await download_and_send_audio(query, context, user_id)
        return ConversationHandler.END
        
    elif action == 'video':
        keyboard = [
            [InlineKeyboardButton("📱 360p (حجم صغير)", callback_data='360')],
            [InlineKeyboardButton("💻 720p (جودة متوسطة)", callback_data='720')],
            [InlineKeyboardButton("📺 1080p (اعلى جودة)", callback_data='1080')],
            [InlineKeyboardButton("🔙 رجوع", callback_data='back')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            "🎬 اختر دقة الفيديو:\n"
            "_ملاحظة: قد لا تتوفر 1080p في بعض الفيديوهات._",
            parse_mode='Markdown',
            reply_markup=reply_markup
        )
        return CHOOSING_QUALITY

# التعامل مع اختيار الجودة
async def choose_quality(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    quality = query.data
    
    if quality == 'back':
        keyboard = [
            [InlineKeyboardButton("🎬 تحميل كفيديو", callback_data='video')],
            [InlineKeyboardButton("🎵 تحميل كصوت MP3", callback_data='audio')],
            [InlineKeyboardButton("❌ إلغاء", callback_data='cancel')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        data = user_data.get(user_id, {})
        duration = data.get('duration', 0)
        minutes = duration // 60
        seconds = duration % 60
        await query.edit_message_text(
            f"*✅ تم جلب البيانات بنجاح*\n\n"
            f"📌 *العنوان:* {data.get('title')}\n"
            f"⏱ *المدة:* {minutes} دقيقة و {seconds} ثانية\n\n"
            f"اختر نوع التحميل:",
            parse_mode='Markdown',
            reply_markup=reply_markup
        )
        return CHOOSING_ACTION
    
    await query.edit_message_text(f"📥 جاري تحميل الفيديو بدقة {quality}p...")
    await download_and_send_video(query, context, user_id, quality)
    return ConversationHandler.END

# دالة تحميل وارسال الفيديو
async def download_and_send_video(query, context, user_id, quality):
    data = user_data.get(user_id)
    if not data:
        await query.edit_message_text("❌ انتهت الجلسة. ارسل الرابط مرة اخرى.")
        return
    
    url = data['url']
    title = data['title']
    
    try:
        format_str = f'bestvideo[height<={quality}]+bestaudio/best[height<={quality}]'
        
        ydl_opts_video = {
            'format': format_str,
            'outtmpl': f'{title}.%(ext)s',
            'restrictfilenames': True,
            'noplaylist': True,
            'quiet': True,
            'merge_output_format': 'mp4',
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
        
        with yt_dlp.YoutubeDL(ydl_opts_video) as ydl:
            await query.edit_message_text(f"📥 يتم الآن تحميل: {title} ({quality}p)...")
            ydl.download([url])
            
        for file in os.listdir('.'):
            if file.endswith(('.mp4', '.mkv', '.webm')) and title[:20] in file:
                file_size = os.path.getsize(file) / (1024 * 1024)
                await query.edit_message_text(f"📤 جاري رفع الملف (حجم: {file_size:.2f} MB)...")
                
                with open(file, 'rb') as f:
                    await context.bot.send_video(
                        chat_id=query.message.chat_id,
                        video=f,
                        caption=f"🎬 {title} ({quality}p)",
                        supports_streaming=True
                    )
                os.remove(file)
                await query.edit_message_text("✅ تم إرسال الفيديو بنجاح يا سيدي.")
                break
                
    except Exception as e:
        await query.edit_message_text(f"⚠️ فشل التحميل: {str(e)}")
    finally:
        if user_id in user_data: del user_data[user_id]

# دالة تحميل وارسال الصوت
async def download_and_send_audio(query, context, user_id):
    data = user_data.get(user_id)
    if not data:
        await query.edit_message_text("❌ انتهت الجلسة.")
        return
    
    url = data['url']
    title = data['title']
    
    try:
        audio_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': f'{title}.%(ext)s',
            'quiet': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
        
        with yt_dlp.YoutubeDL(audio_opts) as ydl:
            await query.edit_message_text(f"🎵 جاري استخراج الصوت: {title}...")
            ydl.download([url])
            
        for file in os.listdir('.'):
            if file.endswith('.mp3') and title[:20] in file:
                file_size = os.path.getsize(file) / (1024 * 1024)
                await query.edit_message_text(f"📤 جاري رفع المقطع الصوتي (حجم: {file_size:.2f} MB)...")
                
                with open(file, 'rb') as f:
                    await context.bot.send_audio(
                        chat_id=query.message.chat_id,
                        audio=f,
                        title=title,
                        performer="YouTube Audio"
                    )
                os.remove(file)
                await query.edit_message_text("✅ تم إرسال الصوت بنجاح يا سيدي.")
                break
                
    except Exception as e:
        await query.edit_message_text(f"⚠️ فشل تحميل الصوت: {str(e)}")
    finally:
        if user_id in user_data: del user_data[user_id]

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("❌ تم إلغاء العملية.")
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
    print("👹 WORM MODE V99: بوت التحميل التفاعلي يعمل...")
    app.run_polling()

if __name__ == '__main__':
    main()
