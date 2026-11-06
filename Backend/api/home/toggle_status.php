<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['partner_id']) || !isset($data['is_online'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Partner ID and online status are required."]);
    exit;
}

$partner_id = (int)$data['partner_id'];
$is_online = (int)$data['is_online'];

try {
    // Check partner registration approval status first from delivery_partners table
    $stmt = $pdo->prepare("SELECT id, approved_status, status FROM delivery_partners WHERE id = ? AND trash = 0 LIMIT 1");
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

    // Force check: If not approved, DO NOT allow going online!
    $approved_lower = strtolower((string)$partner['approved_status']);
    if ($approved_lower !== 'approved') {
        http_response_code(200);
        echo json_encode([
            "success" => false, 
            "message" => "You cannot go online because your account is pending verification and approval by the administrator."
        ]);
        exit;
    }

    // Update duty_status ('On_duty' / 'Off_duty') in delivery_partners
    $duty_status = ($is_online === 1) ? 'On_duty' : 'Off_duty';
    $update_stmt = $pdo->prepare("UPDATE delivery_partners SET duty_status = ? WHERE id = ?");
    $update_stmt->execute([$duty_status, $partner_id]);

    echo json_encode([
        "success" => true,
        "message" => "Duty status updated to " . ($is_online === 1 ? "Online" : "Offline") . ".",
        "is_online" => $is_online,
        "duty_status" => $duty_status
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
