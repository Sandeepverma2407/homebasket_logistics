<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST input JSON
$data = json_decode(file_get_contents("php://input"), true);

$partner_id = isset($data['partner_id']) ? (int)$data['partner_id'] : 0;
$fcm_id = isset($data['fcm_id']) ? trim($data['fcm_id']) : (isset($data['Fcm_Id']) ? trim($data['Fcm_Id']) : '');
$sound_preference = isset($data['sound_preference']) ? trim($data['sound_preference']) : '';

if ($partner_id <= 0) {
    http_response_code(200);
    echo json_encode([
        "success" => false,
        "message" => "Partner ID is required."
    ]);
    exit;
}

try {
    if (!empty($fcm_id) && !empty($sound_preference)) {
        $stmt = $pdo->prepare("UPDATE delivery_partners SET fcm_token = ?, sound_preference = ? WHERE id = ?");
        $stmt->execute([$fcm_id, $sound_preference, $partner_id]);
    } elseif (!empty($fcm_id)) {
        $stmt = $pdo->prepare("UPDATE delivery_partners SET fcm_token = ? WHERE id = ?");
        $stmt->execute([$fcm_id, $partner_id]);
    } elseif (!empty($sound_preference)) {
        $stmt = $pdo->prepare("UPDATE delivery_partners SET sound_preference = ? WHERE id = ?");
        $stmt->execute([$sound_preference, $partner_id]);
    }

    echo json_encode([
        "success" => true,
        "message" => "Partner notification preferences updated successfully."
    ]);
} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>
