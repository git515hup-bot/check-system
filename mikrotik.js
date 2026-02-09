// ==================== مكتبة MikroTik API ====================
class MikroTikManager {
    constructor(ip = CONFIG.MIKROTIK_DEFAULTS.IP, 
                port = CONFIG.MIKROTIK_DEFAULTS.PORT, 
                username = CONFIG.MIKROTIK_DEFAULTS.USERNAME, 
                password = '') {
        this.ip = ip;
        this.port = port;
        this.username = username;
        this.password = password;
        this.isConnected = false;
        this.baseUrl = `http://${ip}:${port}${CONFIG.MIKROTIK_DEFAULTS.API_PATH}`;
    }

    // اختبار الاتصال بالسيرفر
    async testConnection() {
        const statusBox = document.getElementById('connectionStatus');
        
        try {
            const response = await fetch(`${this.baseUrl}/system/identity`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.isConnected = true;
                return {
                    success: true,
                    identity: data.name || 'MikroTik Router',
                    version: data['version'] || 'Unknown'
                };
            } else {
                return {
                    success: false,
                    error: `خطأ ${response.status}: ${response.statusText}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `فشل الاتصال: ${error.message}`
            };
        }
    }

    // التحقق من بطاقة المستخدم
    async validateUserCard(cardNumber) {
        try {
            const response = await fetch(`${this.baseUrl}/ip/hotspot/user/print`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const users = await response.json();
                const user = this.findUserByCard(users, cardNumber);
                
                if (user) {
                    return {
                        success: true,
                        user: this.formatUserData(user)
                    };
                } else {
                    return {
                        success: false,
                        error: CONFIG.MESSAGES.INVALID_CARD
                    };
                }
            } else {
                return {
                    success: false,
                    error: CONFIG.MESSAGES.SERVER_ERROR
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `خطأ في الاتصال: ${error.message}`
            };
        }
    }

    // تفعيل جلسة المستخدم
    async activateUserSession(cardNumber, password, mode = 'Standard') {
        try {
            const clientInfo = await this.getClientInfo();
            
            const response = await fetch(`${this.baseUrl}/ip/hotspot/active/login`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    user: cardNumber,
                    password: password,
                    'mac-address': clientInfo.mac,
                    'ip-address': clientInfo.ip,
                    'comment': `Mode: ${mode}`
                })
            });
            
            if (response.ok) {
                return {
                    success: true,
                    message: 'تم تفعيل الجلسة بنجاح',
                    mode: mode
                };
            } else {
                return {
                    success: false,
                    error: 'فشل في تفعيل الجلسة'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `خطأ في التنفيذ: ${error.message}`
            };
        }
    }

    // ==================== أدوات مساعدة ====================
    
    getAuthHeaders() {
        return {
            'Authorization': 'Basic ' + btoa(`${this.username}:${this.password}`),
            'Content-Type': 'application/json'
        };
    }

    findUserByCard(users, cardNumber) {
        return users.find(u => 
            u.name === cardNumber || 
            u.comment === cardNumber ||
            (u['.id'] && u['.id'].includes(cardNumber))
        );
    }

    formatUserData(user) {
        return {
            name: user.name,
            password: user.password,
            profile: user.profile || 'default',
            uptime: user.uptime || '0s',
            bytesIn: user['bytes-in'] || '0',
            bytesOut: user['bytes-out'] || '0',
            disabled: user.disabled === 'true',
            limit: user['limit-bytes-total'] || '0',
            lastLogin: user['last-logged-out'] || 'غير معروف'
        };
    }

    async getClientInfo() {
        // هذه دالة افتراضية - في الواقع تحتاج للحصول على MAC و IP الحقيقي
        return {
            mac: '00:00:00:00:00:00',
            ip: '192.168.1.100'
        };
    }

    formatBytes(bytes) {
        if (bytes === 0 || !bytes) return '0 بايت';
        const k = 1024;
        const sizes = ['بايت', 'ك.بايت', 'م.بايت', 'ج.بايت'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// إنشاء نسخة عامة من MikroTik Manager
let mikrotik = new MikroTikManager();
