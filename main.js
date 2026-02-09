// ==================== المتغيرات العامة ====================
let isAdminMode = false;
let loginAttempts = 0;

// ==================== تهيئة النظام ====================
function initSystem() {
    setRandomPhrase();
    checkBanStatus();
    loadHistory();
    autoFillLastCard();
    loadServerSettings();
    
    // محاولة الاتصال التلقائي إذا كانت هناك إعدادات محفوظة
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.SERVER);
    if (saved) {
        setTimeout(() => {
            testMikroTikConnection();
        }, 1000);
    }
}

// تعيين عبارة دينية عشوائية
function setRandomPhrase() {
    const phrases = CONFIG.RELIGIOUS_PHRASES;
    document.getElementById('religiousText').innerText = 
        phrases[Math.floor(Math.random() * phrases.length)];
}

// التحقق من حالة الحظر
function checkBanStatus() {
    const banTime = localStorage.getItem(CONFIG.STORAGE_KEYS.BAN);
    if (banTime && (new Date(parseInt(banTime)) - new Date() > 0)) {
        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.style.opacity = '0.5';
        showError(CONFIG.MESSAGES.BANNED);
        return true;
    }
    return false;
}

// ==================== إدارة السيرفر ====================

// تبديل إعدادات السيرفر
function toggleServerSettings() {
    const settings = document.getElementById('serverSettings');
    const btn = document.getElementById('showSettingsBtn');
    
    if (settings.style.display === 'none') {
        settings.style.display = 'block';
        btn.innerHTML = '⚙️ إخفاء إعدادات السيرفر';
        btn.classList.add('active');
    } else {
        settings.style.display = 'none';
        btn.innerHTML = '⚙️ إظهار إعدادات السيرفر';
        btn.classList.remove('active');
    }
}

// اختبار اتصال MikroTik
async function testMikroTikConnection() {
    const statusBox = document.getElementById('connectionStatus');
    const btn = document.querySelector('.btn-test');
    
    // تحديث بيانات المدير
    mikrotik.ip = document.getElementById('serverIp').value;
    mikrotik.port = document.getElementById('apiPort').value;
    mikrotik.username = document.getElementById('adminUser').value;
    mikrotik.password = document.getElementById('adminPass').value;
    mikrotik.baseUrl = `http://${mikrotik.ip}:${mikrotik.port}${CONFIG.MIKROTIK_DEFAULTS.API_PATH}`;
    
    statusBox.innerHTML = '<div class="loading">جاري اختبار الاتصال...</div>';
    statusBox.className = 'status-box info';
    btn.disabled = true;
    btn.innerHTML = '⏳ جاري الاختبار...';
    
    const result = await mikrotik.testConnection();
    
    btn.disabled = false;
    btn.innerHTML = '🔍 اختبار الاتصال';
    
    if (result.success) {
        statusBox.innerHTML = `
            <div class="success">
                <strong>✓ تم الاتصال بنجاح!</strong><br>
                <small>السيرفر: ${result.identity}</small><br>
                <small>الإصدار: ${result.version}</small>
            </div>
        `;
        statusBox.className = 'status-box success';
        
        saveServerSettings();
        isAdminMode = true;
        showAdminFeatures();
    } else {
        statusBox.innerHTML = `
            <div class="error">
                <strong>✗ فشل الاتصال!</strong><br>
                <small>${result.error}</small>
            </div>
        `;
        statusBox.className = 'status-box error';
    }
}

// حفظ إعدادات السيرفر
function saveServerSettings() {
    const settings = {
        ip: mikrotik.ip,
        port: mikrotik.port,
        username: mikrotik.username,
        lastTest: new Date().toLocaleString('ar-SA')
    };
    localStorage.setItem(CONFIG.STORAGE_KEYS.SERVER, JSON.stringify(settings));
}

// تحميل إعدادات السيرفر
function loadServerSettings() {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.SERVER);
    if (saved) {
        const settings = JSON.parse(saved);
        document.getElementById('serverIp').value = settings.ip;
        document.getElementById('apiPort').value = settings.port;
        document.getElementById('adminUser').value = settings.username;
        
        mikrotik.ip = settings.ip;
        mikrotik.port = settings.port;
        mikrotik.username = settings.username;
    }
}

// إظهار ميزات المدير
function showAdminFeatures() {
    const adminLink = document.querySelector('.admin-link');
    if (adminLink && isAdminMode) {
        adminLink.style.display = 'block';
    }
}

// ==================== تسجيل الدخول ====================

// معالجة تسجيل الدخول
async function handleLogin() {
    const userCard = document.getElementById('user').value.trim();
    const errBox = document.getElementById('error-msg');
    const btn = document.getElementById('submitBtn');
    
    // إعادة تعيين الرسالة
    errBox.style.display = 'none';
    
    // التحقق من البطاقة
    if (!userCard || userCard.length < 3) {
        showError('الرجاء إدخال رقم كرت صحيح');
        return false;
    }
    
    // التحقق من الحظر
    if (checkBanStatus()) {
        return false;
    }
    
    // تعطيل الزر وعرض التحميل
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> جاري التحقق...';
    
    try {
        const validation = await mikrotik.validateUserCard(userCard);
        
        if (!validation.success) {
            loginAttempts++;
            if (loginAttempts >= SECURITY.MAX_ATTEMPTS) {
                banUser();
            }
            showError(validation.error);
            resetLoginButton(btn);
            return false;
        }
        
        const userData = validation.user;
        
        if (userData.disabled) {
            showError('هذا الحساب معطل. الرجاء التواصل مع الدعم');
            resetLoginButton(btn);
            return false;
        }
        
        const activation = await mikrotik.activateUserSession(
            userCard, 
            userData.password,
            document.getElementById('speedMode').value
        );
        
        if (activation.success) {
            saveCard(userCard);
            showSuccess(btn);
            setTimeout(() => {
                redirectToDashboard(userCard, userData);
            }, 2000);
        } else {
            showError(activation.error);
            resetLoginButton(btn);
        }
        
    } catch (error) {
        showError(`خطأ غير متوقع: ${error.message}`);
        resetLoginButton(btn);
    }
    
    return false;
}

// ==================== أدوات مساعدة ====================

// حظر المستخدم
function banUser() {
    const banTime = new Date().getTime() + SECURITY.BAN_DURATION;
    localStorage.setItem(CONFIG.STORAGE_KEYS.BAN, banTime.toString());
    showError(CONFIG.MESSAGES.BANNED);
}

// إعادة تعيين زر الدخول
function resetLoginButton(btn) {
    btn.disabled = false;
    btn.innerHTML = 'تســـجيل الدخــول';
}

// عرض النجاح
function showSuccess(btn) {
    btn.innerHTML = '✓ تم الدخول بنجاح!';
    btn.style.background = 'linear-gradient(45deg, #00b09b, #96c93d)';
}

// عرض خطأ
function showError(message) {
    const errBox = document.getElementById('error-msg');
    errBox.innerHTML = `✗ ${message}`;
    errBox.style.display = 'block';
    errBox.style.animation = 'shake 0.5s';
    
    setTimeout(() => {
        errBox.style.animation = '';
    }, 500);
}

// ==================== إدارة البطاقات ====================

// حفظ البطاقة
function saveCard(card) {
    let history = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.CARDS) || "[]");
    if (!history.includes(card)) {
        history.unshift(card);
        if (history.length > 5) history.pop();
        localStorage.setItem(CONFIG.STORAGE_KEYS.CARDS, JSON.stringify(history));
        loadHistory();
    }
}

// تحميل السجل
function loadHistory() {
    const history = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.CARDS) || "[]");
    if (history.length > 0) {
        document.getElementById('historySection').style.display = 'block';
        document.getElementById('cardsList').innerHTML = history.map(card => 
            `<span class="card-tag" onclick="quickLogin('${card}')">${card}</span>`
        ).join('');
    }
}

// تعبئة آخر بطاقة
function autoFillLastCard() {
    const history = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.CARDS) || "[]");
    if (history.length > 0) {
        document.getElementById('user').value = history[0];
    }
}

// دخول سريع
function quickLogin(card) {
    document.getElementById('user').value = card;
    handleLogin();
}

// ==================== لوحة التحكم ====================

// عرض لوحة التحكم
function showAdminPanel() {
    alert('لوحة التحكم قيد التطوير...');
    // هنا يمكنك إضافة رابط إلى صفحة التحكم
}

// توجيه إلى لوحة التحكم
function redirectToDashboard(cardNumber, userData) {
    const dashboardHTML = `
        <div class="dashboard-overlay">
            <div class="dashboard-card">
                <h2>مرحباً بك في شبكة النور</h2>
                <div class="user-stats">
                    <div class="stat">
                        <span class="label">البطاقة:</span>
                        <span class="value">${cardNumber}</span>
                    </div>
                    <div class="stat">
                        <span class="label">الباقة:</span>
                        <span class="value">${userData.profile}</span>
                    </div>
                    <div class="stat">
                        <span class="label">مدة الاتصال:</span>
                        <span class="value">${userData.uptime}</span>
                    </div>
                </div>
                <button onclick="window.location.reload()" class="btn-logout">
                    تسجيل الخروج
                </button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', dashboardHTML);
}
