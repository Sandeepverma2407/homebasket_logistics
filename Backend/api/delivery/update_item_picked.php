<?php
require_once __DIR__ . '/../../connection/config.php';

$raw_input = file_get_contents("php://input");
$data = json_decode($raw_input, true);

if (!isset($data['partner_id']) || !isset($data['job_id']) || !isset($data['item_ids']) || !is_array($data['item_ids'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "partner_id, job_id, and item_ids[] are required."]);
    exit;
}

$partner_id = (int)$data['partner_id'];
$job_id     = (int)$data['job_id'];
$item_ids   = array_values(array_filter(array_map('trim', array_map('strval', $data['item_ids']))));

if (empty($item_ids)) {
    http_response_code(200);
    echo json_encode(["success" => true, "message" => "No items to update."]);
    exit;
}

try {
    // 1. Verify job exists in delivery_jobs and belongs to this partner
    $check = $pdo->prepare("SELECT id, main_order_id, sub_order_id, vendor_id, delivery_boy_id FROM delivery_jobs WHERE id = ?");
    $check->execute([$job_id]);
    $job = $check->fetch(PDO::FETCH_ASSOC);

    if (!$job) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Delivery job not found."]);
        exit;
    }

    if (!empty($job['delivery_boy_id']) && (int)$job['delivery_boy_id'] !== $partner_id) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Unauthorized: Job is not assigned to this partner."]);
        exit;
    }

    $main_order_id = (int)$job['main_order_id'];

    // 2. Build parameterized IN clause to update app_order_items
    // Matches by either product_key or id within the specific order
    // Item ids from the app can be composite keys like "356-433". Comparing those against the
    // integer `id` column makes MySQL (strict mode) abort the UPDATE with error 1292 / SQLSTATE 22007,
    // so only purely numeric ids are matched against `id`; every id is still matched against `product_key`.
    $numeric_ids  = array_values(array_filter($item_ids, 'ctype_digit'));
    $key_marks    = implode(',', array_fill(0, count($item_ids), '?'));
    $params       = array_merge([$main_order_id], $item_ids);

    if (!empty($numeric_ids)) {
        $id_marks = implode(',', array_fill(0, count($numeric_ids), '?'));
        $sql      = "UPDATE app_order_items SET is_picked = 1 WHERE order_id = ? AND (product_key IN ($key_marks) OR id IN ($id_marks))";
        $params   = array_merge($params, $numeric_ids);
    } else {
        $sql = "UPDATE app_order_items SET is_picked = 1 WHERE order_id = ? AND product_key IN ($key_marks)";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    http_response_code(200);
    echo json_encode([
        "success"       => true,
        "updated_count" => $stmt->rowCount(),
        "message"       => "Items marked as picked successfully."
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
