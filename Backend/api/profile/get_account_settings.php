<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST input (supports both JSON payload and $_POST)
$raw_input = file_get_contents("php://input");
$data = json_decode($raw_input, true);

$partner_id = 0;
if (isset($data['partner_id'])) {
    $partner_id = (int)$data['partner_id'];
} elseif (isset($_POST['partner_id'])) {
    $partner_id = (int)$_POST['partner_id'];
}

if ($partner_id <= 0) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Valid Partner ID is required."]);
    exit;
}

try {
    // Fetch bank_details and kyc_docus from delivery_partners table
    $stmt = $pdo->prepare("SELECT id, name, unique_id, contact_no, email_address, bank_details, kyc_docus, approved_status, status 
                           FROM delivery_partners 
                           WHERE id = ? AND trash = 0 
                           LIMIT 1");
    $stmt->execute([$partner_id]);
    $partner = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$partner) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Delivery partner not registered."]);
        exit;
    }

    // 1. Decode bank_details JSON
    $bank_details = null;
    if (!empty($partner['bank_details'])) {
        $decoded_bank = json_decode($partner['bank_details'], true);
        if (is_array($decoded_bank) && !empty($decoded_bank)) {
            $bank_details = $decoded_bank;
        }
    }

    // 2. Decode kyc_docus JSON
    $raw_kyc = [];
    if (!empty($partner['kyc_docus'])) {
        $decoded_kyc = json_decode($partner['kyc_docus'], true);
        if (is_array($decoded_kyc)) {
            $raw_kyc = $decoded_kyc;
        }
    }

    // Normalize into array for mobile app components
    $kyc_documents = [];
    foreach ($raw_kyc as $type => $info) {
        if (is_array($info)) {
            $kyc_documents[] = [
                'document_type' => $info['document_type'] ?? $type,
                'document_no' => $info['document_no'] ?? '',
                'document_path' => $info['document_path'] ?? ($info['path'] ?? ''),
                'is_approved' => $info['is_approved'] ?? 'pending',
                'updated_at' => $info['updated_at'] ?? ''
            ];
        } elseif (is_string($info)) {
            $kyc_documents[] = [
                'document_type' => $type,
                'document_no' => '',
                'document_path' => $info,
                'is_approved' => 'pending',
                'updated_at' => ''
            ];
        }
    }

    echo json_encode([
        "success" => true,
        "bank_details" => $bank_details,
        "kyc_documents" => $kyc_documents,
        "kyc_docus" => $raw_kyc
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
