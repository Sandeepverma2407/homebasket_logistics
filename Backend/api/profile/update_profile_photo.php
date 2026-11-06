<?php
require_once __DIR__ . '/../../connection/config.php';

if (!isset($_POST['partner_id']) || !isset($_FILES['profile_photo'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Partner ID and profile photo are required."]);
    exit;
}

$partner_id = (int)$_POST['partner_id'];
$file = $_FILES['profile_photo'];

if ($partner_id <= 0 || $file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid profile photo upload."]);
    exit;
}

if ((int)$file['size'] > 5 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Profile photo must be smaller than 5 MB."]);
    exit;
}

try {
    $allowed_types = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    $image_info = getimagesize($file['tmp_name']);
    $mime_type = is_array($image_info) ? ($image_info['mime'] ?? '') : '';

    if (!isset($allowed_types[$mime_type])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Only JPG, PNG, and WEBP images are allowed."]);
        exit;
    }

    $stmt = $pdo->prepare("SELECT profile_photo FROM Delivery_Partners WHERE id = ? AND trash = 0 LIMIT 1");
    $stmt->execute([$partner_id]);
    $partner = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$partner) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Delivery partner not found."]);
        exit;
    }

    $sub_dir = "delivery/profile/" . $partner_id;
    $target_dir = rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . $sub_dir;
    if (!is_dir($target_dir) && !mkdir($target_dir, 0775, true)) {
        throw new RuntimeException("Unable to create profile upload directory.");
    }

    $file_name = "profile_" . bin2hex(random_bytes(8)) . "." . $allowed_types[$mime_type];
    $relative_path = $sub_dir . "/" . $file_name;
    $target_file = $target_dir . DIRECTORY_SEPARATOR . $file_name;

    if (!move_uploaded_file($file['tmp_name'], $target_file)) {
        throw new RuntimeException("Failed to save profile photo.");
    }

    $update_stmt = $pdo->prepare("UPDATE Delivery_Partners SET profile_photo = ?, updated_at = NOW() WHERE id = ?");
    $update_stmt->execute([$relative_path, $partner_id]);

    $old_path = (string)($partner['profile_photo'] ?? '');
    if (str_starts_with($old_path, "delivery/profile/{$partner_id}/")) {
        $old_file = rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $old_path);
        if (is_file($old_file) && realpath($old_file) !== realpath($target_file)) {
            @unlink($old_file);
        }
    }

    echo json_encode([
        "success" => true,
        "message" => "Profile photo updated successfully.",
        "profile_photo" => $relative_path,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Unable to update profile photo on the server."]);
}
?>
