<?php
// Secure Environment Detection compatible with PHP 8.2+ & PHP 8.5+ (Handles CLI, Localhost, & Web)
$host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost';
$is_local = (
    $host === 'localhost' ||
    $host === '127.0.0.1' ||
    str_contains($host, 'localhost') ||
    str_contains($host, '127.0.0.1') ||
    $host !== 'mtbstore.digitalbrightindia.cloud'
);

// ── DATABASE CONFIGURATION ───────────────────────────────────────────────────
if ($is_local) {
    define('DB_HOST', '127.0.0.1');
    define('DB_USER', 'root');
    define('DB_PASS', '');
    define('DB_NAME', 'allivo_grocery');
} else {
    // Production database credentials
    define('DB_HOST', 'localhost');
    define('DB_USER', 'homebasket');
    define('DB_PASS', 'me5tBSs6HL4Yym72');
    define('DB_NAME', 'homebasket');
}

// ── PROJECT CONFIGURATION ───────────────────────────────────────────────────
$project_name = 'homebasket';
if (!defined('PROJECT_NAME')) {
    define('PROJECT_NAME', 'homebasket');
}
if (!defined('APP_NAME')) {
    define('APP_NAME', 'HB LOGISTICS');
}

// ── UPLOADS CONFIGURATION ─────────────────────────────────────────────────────
$doc_root = !empty($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') : '/Applications/XAMPP/xamppfiles/htdocs';
define('UPLOAD_DIR', $doc_root . ($is_local ? "/MTB_Project/{$project_name}/portal/uploads/" : "/{$project_name}/portal/uploads/"));

// ── MAILER CONFIGURATION ──────────────────────────────────────────────────────
define('MAIL_URL', $is_local ? "http://127.0.0.1/MTB_Project/{$project_name}/portal/mail/send_generic_mail.php" : "https://mtbstore.digitalbrightindia.cloud/{$project_name}/portal/mail/send_generic_mail.php");

// ── OTP MODE CONFIGURATION (Play Store Verification vs Production) ───────────
// set to false => Play Store / Demo Mode (Fixed OTP: 1234, displayed on screen, no mail sent)
// set to true  => Live Production Mode (Random 4-digit OTP sent to user email)
define('ENABLE_REAL_OTP', true);

// Global Headers for API / CORS
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Handle preflight OPTIONS requests
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Suppress display of PHP warnings/deprecations so API JSON output is never corrupted
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_WARNING);

date_default_timezone_set('Asia/Kolkata');

// ── PDO CONNECTION (PHP 8.2 & PHP 8.5 COMPATIBLE) ──────────────────────────
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ];

    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    $pdo->exec("SET time_zone = '+05:30'");
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed: " . $e->getMessage()
    ]);
    exit;
}
?>