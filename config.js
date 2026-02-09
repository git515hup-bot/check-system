// إعدادات التطبيق
const CONFIG = {
    // إعدادات التخزين
    STORAGE_KEYS: {
        CARDS: 'alnoor_cards',
        SERVER: 'mikrotik_settings',
        BAN: 'alnoor_ban_time'
    },
    
    // العبارات الدينية
    RELIGIOUS_PHRASES: [
        "تذكر أن الله رقيب عليك في كل حين",
        "الأحوال تتغير وعين الله لا تنام",
        "الإنترنت نعمة.. فلا تجعلها نقمة",
        "صلي على النبي ﷺ"
    ],
    
    // إعدادات MikroTik الافتراضية
    MIKROTIK_DEFAULTS: {
        IP: '192.168.88.1',
        PORT: '8728',
        USERNAME: 'admin',
        API_PATH: '/rest'
    },
    
    // سرعات الباقات
    SPEED_MODES: {
        'Standard': 'الوضع التلقائي',
        '100Mbps': '100 ميجابت/ثانية',
        'Gaming': 'وضع الألعاب',
        'Streaming': 'وضع البث'
    },
    
    // الرسائل
    MESSAGES: {
        CONNECTING: 'جاري الاتصال بالسيرفر...',
        VALIDATING: 'جاري التحقق من البطاقة...',
        SUCCESS: 'تم الدخول بنجاح!',
        ERROR: 'حدث خطأ. حاول مرة أخرى',
        INVALID_CARD: 'البطاقة غير مسجلة في النظام',
        SERVER_ERROR: 'خطأ في الاتصال بالسيرفر',
        BANNED: 'تم حظرك مؤقتاً. حاول لاحقاً'
    }
};

// إعدادات الحماية
const SECURITY = {
    MAX_ATTEMPTS: 5,
    BAN_DURATION: 30 * 60 * 1000, // 30 دقيقة
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000 // 24 ساعة
};
