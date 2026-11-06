<?php
require_once __DIR__ . '/../../connection/config.php';
require_once __DIR__ . '/../../connection/settlement_helper.php';

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['partner_id']) || !isset($data['amount'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Partner ID and Amount are required."]);
    exit;
}

$partner_id = (int)$data['partner_id'];
$amount = (float)$data['amount'];
$remarks = isset($data['remarks']) ? trim($data['remarks']) : '';

if ($amount <= 0) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Amount must be greater than zero."]);
    exit;
}

try {
    $pdo->beginTransaction();

    $result = SettlementHelper::createSettlementRequest($pdo, $partner_id, 'deposit', $amount, $remarks);

    $pdo->commit();

    $targetLabel = $result['target_role'] === 'Vendor' ? 'Vendor / Store Manager' : 'Admin';

    echo json_encode([
        "success" => true,
        "message" => "COD deposit request of ₹" . number_format($amount, 2, '.', '') . " submitted to {$targetLabel} for verification.",
        "settlement_no" => $result['settlement_no'],
        "target_role" => $result['target_role'],
        "cash_in_hand" => number_format($result['cash_in_hand'], 2, '.', '')
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(200);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>