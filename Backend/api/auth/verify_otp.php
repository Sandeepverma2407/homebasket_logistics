<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);

$raw_mobile = isset($data['mobile_no']) ? trim((string)$data['mobile_no']) : '';
$clean_mobile = preg_replace('/\D/', '', $raw_mobile);
if (strlen($clean_mobile) > 10) {
    $clean_mobile = substr($clean_mobile, -10);
}

$otp_code = isset($data['otp_code']) ? trim((string)$data['otp_code']) : '';

if (empty($clean_mobile) || empty($otp_code)) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Mobile number and OTP code are required."]);
    exit;
}

try {
    // Fetch partner details from delivery_partners table
    $stmt = $pdo->prepare("SELECT * FROM delivery_partners 
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

    // Verify OTP
    $is_demo_mode = defined('ENABLE_REAL_OTP') && ENABLE_REAL_OTP === false;
    $is_valid_otp = (!empty($partner['otp_code']) && (string)$partner['otp_code'] === $otp_code) 
                 || ($is_demo_mode && $otp_code === '1234');

    if (!$is_valid_otp) {
        http_response_code(200);
        echo json_encode([
            "success" => false, 
            "message" => $is_demo_mode ? "Invalid OTP code. Use 1234 for demo login." : "Invalid OTP code."
        ]);
        exit;
    }

    // Check expiry (skip expiry in demo mode with 1234)
    $current_time = date('Y-m-d H:i:s');
    if (!$is_demo_mode && !empty($partner['otp_expiry']) && $partner['otp_expiry'] < $current_time) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "OTP has expired. Please request a new one."]);
        exit;
    }

    // Check if password is NULL or empty (First-time partner login)
    $is_first_time = empty(trim((string)$partner['password']));
    $app_name = defined('APP_NAME') ? APP_NAME : (defined('PROJECT_NAME') ? PROJECT_NAME : 'mtbstore');
    $welcome_mail_sent = false;

    if ($is_first_time) {
        // Generate secure, human-friendly password: Mtb@ + 4 digits
        $generated_password = 'Mtb@' . mt_rand(1000, 9999);
        $hashed_password = password_hash($generated_password, PASSWORD_BCRYPT);

        // Update partner with new hashed password, clear OTP and update last_login
        $update_stmt = $pdo->prepare("UPDATE delivery_partners 
                                      SET password = ?, otp_code = NULL, otp_expiry = NULL, last_login = ? 
                                      WHERE id = ?");
        $update_stmt->execute([$hashed_password, $current_time, $partner['id']]);

        // Dispatch Welcome First Time Email with Credentials
        if (!empty($partner['email_address'])) {
            $template_path = __DIR__ . '/../../mail_templetes/welcome_partner_template.html';
            if (file_exists($template_path)) {
                $html = file_get_contents($template_path);
                $html = str_replace('{{NAME}}', htmlspecialchars($partner['name']), $html);
                $html = str_replace('{{UNIQUE_ID}}', htmlspecialchars($partner['unique_id'] ?? 'DP-' . $partner['id']), $html);
                $html = str_replace('{{MOBILE_NO}}', htmlspecialchars($partner['contact_no']), $html);
                $html = str_replace('{{EMAIL}}', htmlspecialchars($partner['email_address']), $html);
                $html = str_replace('{{PASSWORD}}', htmlspecialchars($generated_password), $html);
                $html = str_replace('{{APP_NAME}}', htmlspecialchars($app_name), $html);
            } else {
                $html = "<h2>Welcome to {$app_name}, " . htmlspecialchars($partner['name']) . "!</h2>" .
                        "<p>Your account password is: <strong>" . htmlspecialchars($generated_password) . "</strong></p>" .
                        "<p>Partner ID: " . htmlspecialchars($partner['unique_id'] ?? 'DP-' . $partner['id']) . "</p>";
            }

            $subject = "Welcome to {$app_name} Fleet - Your Account Credentials";
            $payload = json_encode([
                'email' => $partner['email_address'],
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
            $res = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            @curl_close($ch);

            if ($http_code === 200) {
                $mail_res = json_decode($res, true);
                $welcome_mail_sent = (isset($mail_res['status']) && $mail_res['status'] === 'success');
            }
        }
    } else {
        // Existing partner: Clear OTP and update last_login
        $clear_stmt = $pdo->prepare("UPDATE delivery_partners 
                                     SET otp_code = NULL, otp_expiry = NULL, last_login = ? 
                                     WHERE id = ?");
        $clear_stmt->execute([$current_time, $partner['id']]);
    }

    $partner['last_login'] = $current_time;

    // Provide client-compatibility aliases matching React Native AuthContext
    $partner['DP_ID'] = $partner['unique_id'];
    $partner['mobile_no'] = $partner['contact_no'];
    $partner['email'] = $partner['email_address'];
    $partner['partner_type'] = !empty($partner['partner_type']) ? $partner['partner_type'] : 'Central';
    $partner['approve_status'] = strtolower((string)$partner['approved_status']);
    $partner['status'] = strtolower((string)$partner['status']);
    $partner['is_online'] = ($partner['duty_status'] === 'On_duty') ? 1 : 0;

    // Decode commission_details for client compatibility
    $comm_details = !empty($partner['commission_details']) ? json_decode($partner['commission_details'], true) : [];
    if (!is_array($comm_details)) {
        $comm_details = [];
    }
    $comm_type = (isset($comm_details['commission_type']) && in_array($comm_details['commission_type'], ['fixed', 'distance'])) ? $comm_details['commission_type'] : 'fixed';
    $comm_rate = isset($comm_details['commission_rate']) ? (float)$comm_details['commission_rate'] : 20.00;
    $min_comm = isset($comm_details['min_commission_amount']) ? (float)$comm_details['min_commission_amount'] : ($comm_type === 'fixed' ? $comm_rate : 20.00);

    $partner['commission_details'] = [
        'commission_type' => $comm_type,
        'commission_rate' => $comm_rate,
        'min_commission_amount' => $min_comm
    ];
    $partner['commission_type'] = $comm_type;
    $partner['commission_rate'] = number_format($comm_rate, 2, '.', '');
    $partner['min_commission_amount'] = number_format($min_comm, 2, '.', '');
    $partner['current_rate'] = $comm_rate;

    // Decode wallet
    $wallet_data = !empty($partner['wallet']) ? json_decode($partner['wallet'], true) : [];
    if (is_array($wallet_data)) {
        if (isset($wallet_data['balance'])) {
            $partner['total_earnings'] = number_format((float)$wallet_data['balance'], 2, '.', '');
        }
        if (isset($wallet_data['cash_in_hand'])) {
            $partner['cash_in_hand'] = number_format((float)$wallet_data['cash_in_hand'], 2, '.', '');
        }
    }

    // Remove sensitive fields
    unset($partner['password']);
    unset($partner['otp_code']);
    unset($partner['otp_expiry']);

    $response_message = $is_first_time
        ? "Welcome! Your new account password has been created and sent to your registered email address."
        : "Verification successful.";

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => $response_message,
        "is_first_time" => $is_first_time,
        "welcome_mail_sent" => $welcome_mail_sent,
        "user" => $partner
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
