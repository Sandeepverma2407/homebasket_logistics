<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['partner_id'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Partner ID is required."]);
    exit;
}

$partner_id = (int)$data['partner_id'];

try {
    $stmt = $pdo->prepare("SELECT * FROM delivery_partners WHERE id = ? AND trash = 0 LIMIT 1");
    $stmt->execute([$partner_id]);
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

    // Decode wallet & calculate live pending settlements
    $wallet_data = !empty($partner['wallet']) ? json_decode($partner['wallet'], true) : [];
    if (!is_array($wallet_data)) $wallet_data = [];

    $pWithStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM delivery_partner_settlements WHERE partner_id = ? AND settlement_type = 'withdrawal' AND status = 'pending'");
    $pWithStmt->execute([$partner_id]);
    $pending_withdrawals = (float)$pWithStmt->fetchColumn();

    $pDepStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM delivery_partner_settlements WHERE partner_id = ? AND settlement_type = 'deposit' AND status = 'pending'");
    $pDepStmt->execute([$partner_id]);
    $pending_deposits = (float)$pDepStmt->fetchColumn();

    $cash_in_hand = (float)($wallet_data['cash_in_hand'] ?? 0);
    $balance = (float)($wallet_data['balance'] ?? ($wallet_data['available_earnings'] ?? 0));
    $available_cash_in_hand = max(0.00, round($cash_in_hand - $pending_deposits, 2));

    $partner['balance'] = number_format($balance, 2, '.', '');
    $partner['total_earnings'] = number_format($balance, 2, '.', '');
    $partner['cash_in_hand'] = number_format($cash_in_hand, 2, '.', '');
    $partner['available_cash_in_hand'] = number_format($available_cash_in_hand, 2, '.', '');
    $partner['pending_withdrawals'] = number_format($pending_withdrawals, 2, '.', '');
    $partner['pending_deposits'] = number_format($pending_deposits, 2, '.', '');

    // Don't return sensitive raw fields
    unset($partner['password']);
    unset($partner['otp_code']);
    unset($partner['otp_expiry']);

    echo json_encode([
        "success" => true,
        "message" => "Profile fetched successfully.",
        "user" => $partner
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
