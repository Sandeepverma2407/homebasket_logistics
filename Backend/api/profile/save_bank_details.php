<?php
require_once __DIR__ . '/../../connection/config.php';

// Check if inputs are provided
if (!isset($_POST['partner_id']) || !isset($_POST['bank_name']) || !isset($_POST['account_number']) || !isset($_POST['account_holder']) || !isset($_POST['ifsc_code'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Required bank fields are missing."]);
    exit;
}

$partner_id = (int)$_POST['partner_id'];
$bank_name = trim((string)$_POST['bank_name']);
$account_number = trim((string)$_POST['account_number']);
$account_holder = trim((string)$_POST['account_holder']);
$account_type = isset($_POST['account_type']) ? trim((string)$_POST['account_type']) : 'saving';
$ifsc_code = strtoupper(trim((string)$_POST['ifsc_code']));
$branch_name = isset($_POST['branch_name']) ? trim((string)$_POST['branch_name']) : '';
$bank_document_type = isset($_POST['bank_document_type']) ? trim((string)$_POST['bank_document_type']) : 'cheque';

// Validate account type enum
if (!in_array($account_type, ['saving', 'current'])) {
    $account_type = 'saving';
}
// Validate bank document type enum
if (!in_array($bank_document_type, ['cheque', 'passbook', 'statement'])) {
    $bank_document_type = 'cheque';
}

try {
    // Check if partner exists in delivery_partners table
    $stmt = $pdo->prepare("SELECT id, bank_details FROM delivery_partners WHERE id = ? AND trash = 0 LIMIT 1");
    $stmt->execute([$partner_id]);
    $partner = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$partner) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Delivery partner not registered."]);
        exit;
    }

    $existing_bank = !empty($partner['bank_details']) ? json_decode($partner['bank_details'], true) : [];
    if (!is_array($existing_bank)) {
        $existing_bank = [];
    }

    $bank_document = $existing_bank['bank_document'] ?? '';

    // Handle file upload
    if (isset($_FILES['bank_document']) && $_FILES['bank_document']['error'] === UPLOAD_ERR_OK) {
        $sub_dir = "bank/" . $partner_id . "/" . date('Y-m');
        $target_dir = UPLOAD_DIR . $sub_dir;
        if (!is_dir($target_dir)) {
            mkdir($target_dir, 0777, true);
        }
        $file_ext = strtolower(pathinfo($_FILES['bank_document']['name'], PATHINFO_EXTENSION));
        if (empty($file_ext)) {
            $file_ext = 'jpg';
        }
        $file_name = "bank_" . uniqid() . "." . $file_ext;
        $bank_document = $sub_dir . "/" . $file_name;
        $target_file = $target_dir . "/" . $file_name;

        if (!move_uploaded_file($_FILES['bank_document']['tmp_name'], $target_file)) {
            http_response_code(200);
            echo json_encode(["success" => false, "message" => "Failed to save uploaded document file."]);
            exit;
        }
    }

    // Assemble bank_details JSON data
    $bank_data = [
        "bank_name" => $bank_name,
        "account_number" => $account_number,
        "account_holder" => $account_holder,
        "account_type" => $account_type,
        "ifsc_code" => $ifsc_code,
        "branch_name" => $branch_name,
        "bank_document_type" => $bank_document_type,
        "bank_document" => $bank_document,
        "updated_at" => date('Y-m-d H:i:s')
    ];

    $bank_json = json_encode($bank_data, JSON_UNESCAPED_SLASHES);

    // Save into delivery_partners under bank_details column
    $update_stmt = $pdo->prepare("UPDATE delivery_partners SET bank_details = ? WHERE id = ?");
    $update_stmt->execute([$bank_json, $partner_id]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Bank details saved successfully.",
        "bank_document" => $bank_document,
        "bank_details" => $bank_data
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
