<?php
require_once __DIR__ . '/../../connection/config.php';

// Helper function to decode and format vendor address JSON
function formatVendorAddress($rawAddr) {
    if (empty($rawAddr)) return 'Store Hub';
    $decoded = json_decode($rawAddr, true);
    if (is_array($decoded)) {
        $parts = [];
        if (!empty($decoded['line1'])) $parts[] = $decoded['line1'];
        if (!empty($decoded['address'])) $parts[] = $decoded['address'];
        if (!empty($decoded['area'])) $parts[] = $decoded['area'];
        if (!empty($decoded['city'])) $parts[] = $decoded['city'];
        if (!empty($decoded['pincode'])) $parts[] = $decoded['pincode'];
        $formatted = implode(', ', $parts);
        return !empty($formatted) ? $formatted : 'Store Hub';
    }
    return (string)$rawAddr;
}

// Helper to format time to 12-hour format
function formatTime12($dateTimeStr) {
    if (!$dateTimeStr) return '';
    return date('h:i A', strtotime($dateTimeStr));
}

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['partner_id'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Partner ID is required."]);
    exit;
}

$partner_id = (int)$data['partner_id'];

try {
    // 1. Fetch partner details to check fleet type & rate
    $stmt_dp = $pdo->prepare("SELECT id, name, partner_type, vendor_id, commission_details FROM delivery_partners WHERE id = ? AND trash = 0 LIMIT 1");
    $stmt_dp->execute([$partner_id]);
    $dp = $stmt_dp->fetch(PDO::FETCH_ASSOC);

    if (!$dp) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Delivery partner not found."]);
        exit;
    }

    $partner_type = $dp['partner_type'] ?? 'Central';
    $partner_vendor_id = (int)($dp['vendor_id'] ?? 0);

    $comm_details = !empty($dp['commission_details']) ? json_decode($dp['commission_details'], true) : [];
    if (!is_array($comm_details)) {
        $comm_details = [];
    }
    $comm_type = (isset($comm_details['commission_type']) && in_array($comm_details['commission_type'], ['fixed', 'distance'])) ? $comm_details['commission_type'] : 'fixed';
    $comm_rate = isset($comm_details['commission_rate']) ? (float)$comm_details['commission_rate'] : 20.00;
    $min_comm = isset($comm_details['min_commission_amount']) ? (float)$comm_details['min_commission_amount'] : ($comm_type === 'fixed' ? $comm_rate : 20.00);
    $fallback_rate = $comm_rate > 0 ? $comm_rate : 20.00;
    $today = date('Y-m-d');

    // 2. Today's Deliveries Count from delivery_jobs
    $stmt_deliv = $pdo->prepare("SELECT COUNT(*) FROM delivery_jobs 
                                 WHERE delivery_boy_id = ? 
                                   AND LOWER(status) = 'delivered' 
                                   AND DATE(updated_at) = ?");
    $stmt_deliv->execute([$partner_id, $today]);
    $today_deliveries = (int)$stmt_deliv->fetchColumn();

    // 3. Today's Earnings Sum from delivery_jobs
    $stmt_earn = $pdo->prepare("SELECT COALESCE(SUM(earning), 0) FROM delivery_jobs 
                                WHERE delivery_boy_id = ? 
                                  AND LOWER(status) = 'delivered' 
                                  AND DATE(updated_at) = ?");
    $stmt_earn->execute([$partner_id, $today]);
    $today_earnings = (float)$stmt_earn->fetchColumn();

    // 4. Completed Jobs list (Delivered)
    $sql_completed = "SELECT dj.id, dj.job_no, dj.earning AS payout_amount, dj.created_at, dj.updated_at,
                             v.shop_name AS restaurant_name
                      FROM delivery_jobs dj
                      LEFT JOIN admin_vendors v ON dj.vendor_id = v.id
                      WHERE dj.delivery_boy_id = ? AND LOWER(dj.status) = 'delivered'
                      ORDER BY dj.updated_at DESC LIMIT 10";
    $stmt_comp = $pdo->prepare($sql_completed);
    $stmt_comp->execute([$partner_id]);
    $completed_rows = $stmt_comp->fetchAll(PDO::FETCH_ASSOC);

    $completed_list = [];
    foreach ($completed_rows as $row) {
        $payout = (float)$row['payout_amount'] > 0 ? (float)$row['payout_amount'] : $fallback_rate;
        $completed_list[] = [
            "id" => "#JOB-" . $row['job_no'],
            "time" => formatTime12($row['updated_at'] ?: $row['created_at']),
            "store" => $row['restaurant_name'] ?: 'MTB Grocery Store',
            "amount" => "₹" . number_format($payout, 2, '.', '')
        ];
    }

    // 5. Pending / Active Jobs list (Assigned to this partner, not yet delivered)
    $sql_pending = "SELECT dj.id, dj.job_no, dj.status AS job_status, dj.earning AS payout_amount, dj.created_at,
                           v.shop_name AS restaurant_name, v.address AS restaurant_address,
                           u.name AS user_name, u.mobile AS user_phone,
                           o.address_name, o.address_mobile, o.address_flat, o.address_locality, o.address_city, o.address_pincode,
                           s.subtotal AS sub_order_total, o.total_amount AS order_total
                    FROM delivery_jobs dj
                    LEFT JOIN admin_vendors v ON dj.vendor_id = v.id
                    LEFT JOIN app_users u ON dj.user_id = u.id
                    LEFT JOIN app_orders o ON dj.main_order_id = o.id
                    LEFT JOIN app_sub_orders s ON dj.sub_order_id = s.id
                    WHERE dj.delivery_boy_id = ? 
                      AND LOWER(dj.status) NOT IN ('delivered', 'cancelled', 'rejected')
                    ORDER BY dj.id DESC";
    $stmt_pend = $pdo->prepare($sql_pending);
    $stmt_pend->execute([$partner_id]);
    $pending_rows = $stmt_pend->fetchAll(PDO::FETCH_ASSOC);

    $pending_list = [];
    foreach ($pending_rows as $row) {
        $delivery_addr = implode(', ', array_filter([
            $row['address_flat'], 
            $row['address_locality'], 
            $row['address_city'], 
            $row['address_pincode']
        ]));

        $payout = (float)$row['payout_amount'] > 0 ? (float)$row['payout_amount'] : $fallback_rate;
        $customer_name = $row['address_name'] ?: ($row['user_name'] ?: 'Customer');
        $customer_phone = $row['address_mobile'] ?: ($row['user_phone'] ?: '');
        $order_val = (float)$row['order_total'];

        $pending_list[] = [
            "id" => "#JOB-" . $row['job_no'],
            "db_id" => (int)$row['id'],
            "status" => strtoupper((string)$row['job_status']),
            "time" => formatTime12($row['created_at']),
            "store" => $row['restaurant_name'] ?: 'MTB Grocery Store',
            "amount" => "₹" . number_format($payout, 2, '.', ''),
            "to_pay" => number_format($order_val, 2, '.', ''),
            "pickup_address" => formatVendorAddress($row['restaurant_address']),
            "delivery_address" => $delivery_addr ?: 'Customer Address',
            "user_name" => $customer_name,
            "user_phone" => $customer_phone
        ];
    }

    // Fetch platform active_pd_mode from admin_settings
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

    // 6. New Order Requests Queue (Pending, unassigned) - Filtered Partner-Wise
    if ($partner_type === 'Vendor' && $partner_vendor_id > 0) {
        if ($activePdMode === 'vendor_point') {
            $sql_requests = "SELECT dj.id, dj.job_no, dj.earning AS payout_amount, dj.estimated_distance, dj.created_at,
                                    v.shop_name AS restaurant_name, v.address AS restaurant_address
                             FROM delivery_jobs dj
                             LEFT JOIN admin_vendors v ON dj.vendor_id = v.id
                             WHERE LOWER(dj.status) = 'pending' 
                               AND (dj.delivery_boy_id = 0 OR dj.delivery_boy_id IS NULL)
                               AND dj.vendor_id = ?
                               AND dj.delivery_type = 'self'
                             ORDER BY dj.id DESC";
            $stmt_req = $pdo->prepare($sql_requests);
            $stmt_req->execute([$partner_vendor_id]);
            $request_rows = $stmt_req->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $request_rows = [];
        }
    } else {
        $sql_requests = "SELECT dj.id, dj.job_no, dj.earning AS payout_amount, dj.estimated_distance, dj.created_at,
                                v.shop_name AS restaurant_name, v.address AS restaurant_address
                         FROM delivery_jobs dj
                         LEFT JOIN admin_vendors v ON dj.vendor_id = v.id
                         WHERE LOWER(dj.status) = 'pending' 
                           AND (dj.delivery_boy_id = 0 OR dj.delivery_boy_id IS NULL)
                           AND (dj.delivery_type = 'centralized' OR dj.delivery_type IS NULL)
                           AND (dj.delivery_type != 'self' OR dj.delivery_type IS NULL)
                           AND (v.delivey_sysytem IS NULL OR v.delivey_sysytem NOT LIKE '%\"delivery_system_type\":\"self\"%' OR ? != 'vendor_point')
                         ORDER BY dj.id DESC";
        $stmt_req = $pdo->prepare($sql_requests);
        $stmt_req->execute([$activePdMode]);
        $request_rows = $stmt_req->fetchAll(PDO::FETCH_ASSOC);
    }

    $request_queue = [];
    foreach ($request_rows as $row) {
        $distance = (float)($row['estimated_distance'] ?: 2.5);
        $time_away = (int)round($distance * 4); // ~4 mins per km
        $amount = (float)$row['payout_amount'];
        if ($amount <= 0) {
            if ($comm_type === 'distance') {
                $amount = max($min_comm, round($distance * $comm_rate, 2));
            } else {
                $amount = $fallback_rate;
            }
        }

        $request_queue[] = [
            "id" => (int)$row['id'],
            "custom_order_id" => "#JOB-" . $row['job_no'],
            "pickup" => $row['restaurant_name'] ?: 'MTB Grocery Hub',
            "pickup_address" => formatVendorAddress($row['restaurant_address']),
            "amount" => number_format($amount, 2, '.', ''),
            "distance" => number_format($distance, 1, '.', ''),
            "time_away" => $time_away > 0 ? $time_away : 10,
            "commission_type" => $comm_type,
            "commission_rate" => number_format($comm_rate, 2, '.', ''),
            "min_commission_amount" => number_format($min_comm, 2, '.', '')
        ];
    }

    echo json_encode([
        "success" => true,
        "today_earnings" => $today_earnings,
        "today_deliveries" => $today_deliveries,
        "current_rate" => number_format($fallback_rate, 2, '.', ''),
        "commission_details" => [
            "commission_type" => $comm_type,
            "commission_rate" => $comm_rate,
            "min_commission_amount" => $min_comm
        ],
        "completed_jobs" => $completed_list,
        "pending_jobs" => $pending_list,
        "request_queue" => $request_queue
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
