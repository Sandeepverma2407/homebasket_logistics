<?php
require_once __DIR__ . '/../../connection/config.php';

// Check if inputs are provided
if (!isset($_POST['partner_id']) || !isset($_POST['document_type']) || !isset($_POST['document_no'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Required KYC fields are missing."]);
    exit;
}

$partner_id = (int)$_POST['partner_id'];
$document_type = trim((string)$_POST['document_type']);
$document_no = strtoupper(trim((string)$_POST['document_no']));

// Validate document type
$allowed_types = ['aadhar', 'pan', 'vehicle', 'driving_licence'];
if (!in_array($document_type, $allowed_types)) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Invalid document type: " . $document_type]);
    exit;
}

try {
    // Check if partner exists in delivery_partners table
    $stmt = $pdo->prepare("SELECT id, kyc_docus FROM delivery_partners WHERE id = ? AND trash = 0 LIMIT 1");
    $stmt->execute([$partner_id]);
    $partner = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$partner) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Delivery partner not registered."]);
        exit;
    }

    $existing_kyc = !empty($partner['kyc_docus']) ? json_decode($partner['kyc_docus'], true) : [];
    if (!is_array($existing_kyc)) {
        $existing_kyc = [];
    }

    $existing_doc = $existing_kyc[$document_type] ?? null;
    $document_path = '';
    if (is_array($existing_doc)) {
        $document_path = $existing_doc['document_path'] ?? ($existing_doc['path'] ?? '');
    } elseif (is_string($existing_doc)) {
        $document_path = $existing_doc;
    }

    $has_new_file = isset($_FILES['kyc_document']) && $_FILES['kyc_document']['error'] === UPLOAD_ERR_OK;

    // Validate that if there's no existing document, a file MUST be uploaded
    if (empty($document_path) && !$has_new_file) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Document file is required for initial upload."]);
        exit;
    }

    // Handle file upload
    if ($has_new_file) {
        $sub_dir = "kyc/" . $partner_id . "/" . date('Y-m');
        $target_dir = UPLOAD_DIR . $sub_dir;
        if (!is_dir($target_dir)) {
            mkdir($target_dir, 0777, true);
        }
        $file_ext = strtolower(pathinfo($_FILES['kyc_document']['name'], PATHINFO_EXTENSION));
        if (empty($file_ext)) {
            $file_ext = 'jpg';
        }
        $file_name = "kyc_" . $document_type . "_" . uniqid() . "." . $file_ext;
        $document_path = $sub_dir . "/" . $file_name;
        $target_file = $target_dir . "/" . $file_name;

        if (!move_uploaded_file($_FILES['kyc_document']['tmp_name'], $target_file)) {
            http_response_code(200);
            echo json_encode(["success" => false, "message" => "Failed to save uploaded document file."]);
            exit;
        }
    }

    // Save document details under kyc_docus
    $existing_kyc[$document_type] = [
        "document_type" => $document_type,
        "document_no" => $document_no,
        "document_path" => $document_path,
        "is_approved" => "pending",
        "updated_at" => date('Y-m-d H:i:s')
    ];

    $kyc_json = json_encode($existing_kyc, JSON_UNESCAPED_SLASHES);

    // Update delivery_partners table kyc_docus column
    $update_stmt = $pdo->prepare("UPDATE delivery_partners SET kyc_docus = ? WHERE id = ?");
    $update_stmt->execute([$kyc_json, $partner_id]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "KYC document saved successfully.",
        "document_path" => $document_path,
        "is_approved" => "pending"
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
