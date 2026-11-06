<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['partner_id']) || !isset($data['job_id'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Partner ID and Job ID are required."]);
    exit;
}

$partner_id = (int)$data['partner_id'];
$job_id = (int)$data['job_id'];

try {
    // Start transaction
    $pdo->beginTransaction();

    // 1. Fetch partner record
    $dp_stmt = $pdo->prepare("SELECT id, name, partner_type, vendor_id, commission_details FROM delivery_partners WHERE id = ? AND trash = 0 LIMIT 1 FOR UPDATE");
    $dp_stmt->execute([$partner_id]);
    $partner = $dp_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$partner) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "Delivery partner not found."]);
        exit;
    }

    // 2. Fetch job from delivery_jobs
    $stmt = $pdo->prepare("SELECT * FROM delivery_jobs WHERE id = ? FOR UPDATE");
    $stmt->execute([$job_id]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$job) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "Delivery job not found."]);
        exit;
    }

    // 3. Ensure order is not accepted by another partner
    if (!empty($job['delivery_boy_id']) && (int)$job['delivery_boy_id'] !== 0 && (int)$job['delivery_boy_id'] !== $partner_id) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "This order has already been accepted by another partner."]);
        exit;
    }

    if (strtolower($job['status']) !== 'pending' && (int)$job['delivery_boy_id'] !== $partner_id) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "This order is already accepted or processed."]);
        exit;
    }

    // 4. Partner-wise fleet validation
    $activePdMode = 'hub_point';
    try {
        $stmtPd = $pdo->prepare("SELECT table_data FROM admin_settings WHERE vendor_id = 0 AND user_type = 'superadmin' AND table_name = 'pd_plan_config' ORDER BY id DESC LIMIT 1");
        $stmtPd->execute();
        $pdRow = $stmtPd->fetch(PDO::FETCH_ASSOC);
        if ($pdRow && !empty($pdRow['table_data'])) {
            $pdData = json_decode($pdRow['table_data'], true);
            $rawMode = $pdData['active_pd_mode'] ?? $pdData['o'] ?? 'hub_point';
            $activePdMode = ($rawMode === 'vendor' || $rawMode === 'vendor_point') ? 'vendor_point' : 'hub_point';
        }
    } catch (Exception $e) {}

    // Fetch vendor delivery system configuration
    $vStmt = $pdo->prepare("SELECT delivey_sysytem FROM admin_vendors WHERE id = ?");
    $vStmt->execute([$job['vendor_id']]);
    $vRow = $vStmt->fetch(PDO::FETCH_ASSOC);
    $vDeliv = (!empty($vRow) && !empty($vRow['delivey_sysytem'])) ? json_decode($vRow['delivey_sysytem'], true) : [];
    $vSysType = $vDeliv['delivery_system_type'] ?? 'centralized';

    $deliveryType = $job['delivery_type'] ?? null;
    if (empty($deliveryType)) {
        $deliveryType = ($activePdMode === 'vendor_point' && $vSysType === 'self') ? 'self' : 'centralized';
    }
    $isJobSelf = ($deliveryType === 'self');

    if ($isJobSelf) {
        // Self Delivery Job: Only that vendor's self delivery partner can accept
        if ($partner['partner_type'] !== 'Vendor' || (int)$partner['vendor_id'] !== (int)$job['vendor_id']) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "Unauthorized: This order is fulfilled exclusively by the vendor's self-delivery fleet."]);
            exit;
        }
    } else {
        // Centralized Delivery Job: Only Central partners can accept
        if ($partner['partner_type'] === 'Vendor' && !empty($partner['vendor_id'])) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "Unauthorized: This order is fulfilled exclusively by Centralized Delivery partners."]);
            exit;
        }
    }

    // 5. Payout amount
    $payout_amount = (float)$job['earning'];
    if ($payout_amount <= 0) {
        $comm = !empty($partner['commission_details']) ? json_decode($partner['commission_details'], true) : [];
        if (!is_array($comm)) {
            $comm = [];
        }
        $cType = (isset($comm['commission_type']) && in_array($comm['commission_type'], ['fixed', 'distance'])) ? $comm['commission_type'] : 'fixed';
        $cRate = isset($comm['commission_rate']) ? (float)$comm['commission_rate'] : 20.00;
        $cMin = isset($comm['min_commission_amount']) ? (float)$comm['min_commission_amount'] : ($cType === 'fixed' ? $cRate : 20.00);
        $job_dist = (float)($job['estimated_distance'] ?? 0);

        if ($cType === 'distance' && $job_dist > 0) {
            $payout_amount = max($cMin, round($job_dist * $cRate, 2));
        } else {
            $payout_amount = $cRate > 0 ? $cRate : 20.00;
        }
    }

    // 6. Generate secure 4-digit pickup OTP & Update delivery_jobs
    $pickup_otp = str_pad((string)random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
    $update_stmt = $pdo->prepare("UPDATE delivery_jobs SET status = 'accepted', delivery_boy_id = ?, earning = ?, pickup_otp = ?, accepted_at = NOW(), updated_at = NOW() WHERE id = ?");
    $update_stmt->execute([$partner_id, $payout_amount, $pickup_otp, $job_id]);

    // 7. Update app_sub_orders and app_orders with assigned delivery_boy_id
    if (!empty($job['sub_order_id'])) {
        $sub_stmt = $pdo->prepare("UPDATE app_sub_orders SET delivery_boy_id = ?, updated_at = NOW() WHERE id = ?");
        $sub_stmt->execute([$partner_id, $job['sub_order_id']]);
    }
    if (!empty($job['main_order_id'])) {
        $ord_stmt = $pdo->prepare("UPDATE app_orders SET delivery_boy_id = ?, updated_at = NOW() WHERE id = ? AND (delivery_boy_id IS NULL OR delivery_boy_id = 0)");
        $ord_stmt->execute([$partner_id, $job['main_order_id']]);
    }

    // 8. Insert log into delivery_job_logs
    $log_stmt = $pdo->prepare("INSERT INTO delivery_job_logs (job_id, sub_order_id, delivery_boy_id, previous_status, new_status, remarks, created_at) VALUES (?, ?, ?, ?, 'accepted', 'Accepted by delivery partner', NOW())");
    $log_stmt->execute([$job_id, $job['sub_order_id'], $partner_id, $job['status']]);

    // Commit transaction
    $pdo->commit();

    echo json_encode([
        "success" => true,
        "message" => "Order accepted successfully!",
        "payout_amount" => number_format($payout_amount, 2, '.', '')
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Server error: " . $e->getMessage()]);
}
?>
