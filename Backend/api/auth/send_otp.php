<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);

$raw_mobile = isset($data['mobile_no']) ? trim((string)$data['mobile_no']) : '';
// Normalize mobile number (last 10 digits)
$clean_mobile = preg_replace('/\D/', '', $raw_mobile);
if (strlen($clean_mobile) > 10) {
    $clean_mobile = substr($clean_mobile, -10);
}

if (empty($clean_mobile) || strlen($clean_mobile) < 10) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Valid 10-digit mobile number is required."]);
    exit;
}

// Query delivery partner by contact_no from delivery_partners table
try {
    $stmt = $pdo->prepare("SELECT id, unique_id, name, contact_no, email_address, approved_status, status 
                           FROM delivery_partners 
                           WHERE (contact_no = ? OR contact_no LIKE ?) AND trash = 0 
                           LIMIT 1");
    $stmt->execute([$clean_mobile, "%" . $clean_mobile]);
    $partner = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$partner) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Delivery partner not registered."]);
        exit;
    }

    $status_lower = strtolower((string)$partner['status']);
    if ($status_lower === 'suspended' || $status_lower === 'blocked') {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Your account is suspended. Contact administrator."]);
        exit;
    }

    if (empty($partner['email_address'])) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "No registered email address found for this account."]);
        exit;
    }

    // Check ENABLE_REAL_OTP mode (defined in config.php)
    $is_real_otp = defined('ENABLE_REAL_OTP') ? ENABLE_REAL_OTP : true;

    if (!$is_real_otp) {
        // Demo Mode: Fixed OTP 1234, no email sent
        $otp = "1234";
        $expiry = date('Y-m-d H:i:s', strtotime('+60 minutes'));

        $update_stmt = $pdo->prepare("UPDATE delivery_partners SET otp_code = ?, otp_expiry = ? WHERE id = ?");
        $update_stmt->execute([$otp, $expiry, $partner['id']]);

        http_response_code(200);
        echo json_encode([
            "success" => true,
            "is_demo" => true,
            "demo_otp" => "1234",
            "message" => "Demo Mode: Your verification OTP is 1234."
        ]);
        exit;
    }

    // Live Mode: Generate 4-digit random OTP & send via email
    $otp = (string) rand(1000, 9999);
    $expiry = date('Y-m-d H:i:s', strtotime('+5 minutes'));

    // Store OTP in database
    $update_stmt = $pdo->prepare("UPDATE delivery_partners SET otp_code = ?, otp_expiry = ? WHERE id = ?");
    $update_stmt->execute([$otp, $expiry, $partner['id']]);

    // Send OTP email
    $email = $partner['email_address'];
    $name = $partner['name'];
    $app_name = defined('APP_NAME') ? APP_NAME : (defined('PROJECT_NAME') ? PROJECT_NAME : 'mtbstore');
    $subject = "Your {$app_name} OTP Verification Code";

    // Load and populate template
    $template_path = __DIR__ . '/../../mail_templetes/otp_template.html';
    if (file_exists($template_path)) {
        $html = file_get_contents($template_path);
        $html = str_replace('{{NAME}}', htmlspecialchars($name), $html);
        $html = str_replace('{{OTP}}', htmlspecialchars($otp), $html);
        $html = str_replace('{{APP_NAME}}', htmlspecialchars($app_name), $html);
    } else {
        $html = "<h3>Hello " . htmlspecialchars($name) . ",</h3><p>Your OTP is: <strong>" . htmlspecialchars($otp) . "</strong></p>";
    }

    // Call MAIL_URL
    $payload = json_encode([
        'email' => $email,
        'subject' => $subject,
        'message' => $html
    ]);

    $ch = curl_init(MAIL_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($payload)
    ]);

    $response_data = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    @curl_close($ch);

    $mail_sent = false;
    if ($http_code === 200) {
        $res = json_decode($response_data, true);
        $mail_sent = (isset($res['status']) && $res['status'] === 'success');
    }

    // Helper to mask email for safe display (e.g., sa***@gmail.com)
    $email_parts = explode('@', $email);
    $masked_email = substr($email_parts[0], 0, min(2, strlen($email_parts[0]))) . '***@' . ($email_parts[1] ?? '');

    if ($mail_sent) {
        http_response_code(200);
        echo json_encode([
            "success" => true, 
            "message" => "OTP sent successfully to your registered email address ({$masked_email})."
        ]);
    } else {
        http_response_code(200);
        echo json_encode([
            "success" => false,
            "message" => "Failed to send OTP email. Please try again later.",
            "debug_error" => $response_data
        ]);
    }

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>