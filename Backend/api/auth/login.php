<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['identifier']) || !isset($data['password']) || empty(trim($data['identifier'])) || empty(trim($data['password']))) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Mobile number/Partner ID and password are required."]);
    exit;
}

$raw_identifier = trim($data['identifier']);
$password = trim($data['password']);

// Extract clean 10-digit mobile if identifier is numeric
$clean_mobile = preg_replace('/\D/', '', $raw_identifier);
if (strlen($clean_mobile) > 10) {
    $clean_mobile = substr($clean_mobile, -10);
}

try {
    // Check by contact_no OR unique_id
    $stmt = $pdo->prepare("SELECT * FROM delivery_partners 
                           WHERE (contact_no = ? OR contact_no LIKE ? OR unique_id = ?) 
                             AND trash = 0 
                           LIMIT 1");
    $stmt->execute([
        $clean_mobile ?: $raw_identifier, 
        "%" . ($clean_mobile ?: $raw_identifier), 
        $raw_identifier
    ]);
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

    // Check if password has been created
    if (empty($partner['password'])) {
        http_response_code(200);
        echo json_encode([
            "success" => false, 
            "password_not_set" => true,
            "message" => "Password not set yet. Please log in using OTP to automatically receive your account password via email."
        ]);
        exit;
    }

    // Verify password against bcrypt hash
    if (!password_verify($password, $partner['password'])) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Invalid mobile number/Partner ID or password."]);
        exit;
    }

    // Password matches! Clear OTP fields and set last_login
    $current_time = date('Y-m-d H:i:s');
    $clear_stmt = $pdo->prepare("UPDATE delivery_partners 
                                 SET otp_code = NULL, otp_expiry = NULL, last_login = ? 
                                 WHERE id = ?");
    $clear_stmt->execute([$current_time, $partner['id']]);

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

    // Don't return sensitive raw fields
    unset($partner['password']);
    unset($partner['otp_code']);
    unset($partner['otp_expiry']);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Login successful.",
        "user" => $partner
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
