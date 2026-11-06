<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST JSON input
$data = json_decode(file_get_contents("php://input"), true);
$partner_id = isset($data['partner_id']) ? (int)$data['partner_id'] : 0;

if ($partner_id > 0) {
    try {
        // Set partner to Off_duty so they no longer receive order dispatch notifications
        $stmt = $pdo->prepare("UPDATE delivery_partners SET duty_status = 'Off_duty' WHERE id = ?");
        $stmt->execute([$partner_id]);
    } catch (Exception $e) {
        // Non-critical, continue
    }
}

http_response_code(200);
echo json_encode([
    "success" => true,
    "message" => "Logged out successfully."
]);

