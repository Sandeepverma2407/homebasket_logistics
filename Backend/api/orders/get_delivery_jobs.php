<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['partner_id'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Partner ID is required."]);
    exit;
}

$partner_id = (int)$data['partner_id'];

try {
    // 1. Fetch delivery partner details to determine fleet type & assigned vendor
    $dp_stmt = $pdo->prepare("SELECT id, name, partner_type, vendor_id, commission_details FROM delivery_partners WHERE id = ? AND trash = 0 LIMIT 1");
    $dp_stmt->execute([$partner_id]);
    $partner = $dp_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$partner) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Delivery partner not found."]);
        exit;
    }

    $partner_type = $partner['partner_type'] ?? 'Central';
    $partner_vendor_id = (int)($partner['vendor_id'] ?? 0);

    $comm_details = !empty($partner['commission_details']) ? json_decode($partner['commission_details'], true) : [];
    if (!is_array($comm_details)) {
        $comm_details = [];
    }
    $comm_type = (isset($comm_details['commission_type']) && in_array($comm_details['commission_type'], ['fixed', 'distance'])) ? $comm_details['commission_type'] : 'fixed';
    $comm_rate = isset($comm_details['commission_rate']) ? (float)$comm_details['commission_rate'] : 20.00;
    $min_comm = isset($comm_details['min_commission_amount']) ? (float)$comm_details['min_commission_amount'] : ($comm_type === 'fixed' ? $comm_rate : 20.00);
    $partner_rate = $comm_rate > 0 ? $comm_rate : 20.00;

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

    // 2. Build partner-wise query for delivery jobs based on active PD mode & vendor delivery system
    // - If Vendor partner: strictly self-delivery jobs (dj.delivery_type = 'self') for their specific vendor when active PD mode is vendor_point
    // - If Central partner: strictly centralized delivery jobs (dj.delivery_type = 'centralized' or non-self fallback)
    if ($partner_type === 'Vendor' && $partner_vendor_id > 0) {
        if ($activePdMode === 'vendor_point') {
            $whereClause = "((dj.delivery_boy_id = ? AND dj.delivery_type = 'self') OR (LOWER(dj.status) = 'pending' AND (dj.delivery_boy_id = 0 OR dj.delivery_boy_id IS NULL) AND dj.vendor_id = ? AND dj.delivery_type = 'self'))";
            $params = [$partner_id, $partner_vendor_id];
        } else {
            $whereClause = "(dj.delivery_boy_id = ? AND dj.delivery_type = 'self')";
            $params = [$partner_id];
        }
    } else {
        $whereClause = "((dj.delivery_boy_id = ? AND (dj.delivery_type = 'centralized' OR dj.delivery_type IS NULL)) OR (LOWER(dj.status) = 'pending' AND (dj.delivery_boy_id = 0 OR dj.delivery_boy_id IS NULL) AND (dj.delivery_type = 'centralized' OR (dj.delivery_type IS NULL AND (v.delivey_sysytem IS NULL OR v.delivey_sysytem NOT LIKE '%\"delivery_system_type\":\"self\"%' OR ? != 'vendor_point'))) AND (dj.delivery_type != 'self' OR dj.delivery_type IS NULL)))";
        $params = [$partner_id, $activePdMode];
    }

    $sql = "SELECT 
                dj.id AS job_id,
                dj.job_no,
                dj.main_order_id,
                dj.sub_order_id,
                dj.vendor_id,
                dj.delivery_boy_id,
                dj.status AS job_status,
                dj.earning AS payout_amount,
                dj.estimated_distance,
                dj.created_at AS job_created_at,
                dj.updated_at AS job_delivered_at,
                o.order_no AS custom_order_id,
                o.total_amount AS order_total,
                o.payment_method,
                o.address_name,
                o.address_mobile,
                o.address_flat,
                o.address_locality,
                o.address_city,
                o.address_pincode,
                o.checkout_latitude AS user_latitude,
                o.checkout_longitude AS user_longitude,
                v.shop_name AS restaurant_name,
                v.address AS restaurant_address,
                u.name AS user_name,
                u.mobile AS user_phone,
                s.subtotal AS sub_order_total
            FROM delivery_jobs dj
            LEFT JOIN app_orders o ON dj.main_order_id = o.id
            LEFT JOIN app_sub_orders s ON dj.sub_order_id = s.id
            LEFT JOIN admin_vendors v ON dj.vendor_id = v.id
            LEFT JOIN app_users u ON dj.user_id = u.id
            WHERE {$whereClause}
            ORDER BY dj.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $jobs = [];
    foreach ($rows as $row) {
        $payout = (float)$row['payout_amount'];
        if ($payout <= 0) {
            $est_dist = (float)($row['estimated_distance'] ?: 0);
            if ($comm_type === 'distance' && $est_dist > 0) {
                $payout = max($min_comm, round($est_dist * $comm_rate, 2));
            } else {
                $payout = $partner_rate;
            }
        }

        // Fetch order items specifically for this order & vendor
        $items_stmt = $pdo->prepare("SELECT id, product_key AS item_id, product_name AS name, price, quantity, image, is_picked 
                                     FROM app_order_items 
                                     WHERE order_id = ? AND vendor_id = ?");
        $items_stmt->execute([$row['main_order_id'], $row['vendor_id']]);
        $items = $items_stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fallback to order-level items if vendor-specific not found
        if (empty($items)) {
            $fallback_stmt = $pdo->prepare("SELECT id, product_key AS item_id, product_name AS name, price, quantity, image, is_picked 
                                           FROM app_order_items 
                                           WHERE order_id = ?");
            $fallback_stmt->execute([$row['main_order_id']]);
            $items = $fallback_stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        // Format customer delivery address
        $delivery_addr = implode(', ', array_filter([
            $row['address_flat'], 
            $row['address_locality'], 
            $row['address_city'], 
            $row['address_pincode']
        ]));

        // Decode vendor JSON address: {"pincode":"834001","city":"Ranchi"}
        $vendor_addr_raw = $row['restaurant_address'];
        $formatted_vendor_address = '';
        $vendor_city = 'Store Location';

        if (!empty($vendor_addr_raw)) {
            $addr_json = json_decode($vendor_addr_raw, true);
            if (is_array($addr_json)) {
                $vParts = [];
                if (!empty($addr_json['line1'])) $vParts[] = $addr_json['line1'];
                if (!empty($addr_json['address'])) $vParts[] = $addr_json['address'];
                if (!empty($addr_json['area'])) $vParts[] = $addr_json['area'];
                if (!empty($addr_json['city'])) {
                    $vParts[] = $addr_json['city'];
                    $vendor_city = $addr_json['city'];
                }
                if (!empty($addr_json['pincode'])) {
                    $vParts[] = $addr_json['pincode'];
                }
                $formatted_vendor_address = implode(', ', $vParts);
            } else {
                $formatted_vendor_address = (string)$vendor_addr_raw;
            }
        }
        if (empty($formatted_vendor_address)) {
            $formatted_vendor_address = 'Store Hub';
        }

        // Customer contact details
        $customer_name = $row['address_name'] ?: ($row['user_name'] ?: 'Customer');
        $customer_phone = $row['address_mobile'] ?: ($row['user_phone'] ?: '');

        // Complete customer order amount to collect (from app_orders.total_amount)
        $to_pay = (float)$row['order_total'];

        $jobs[] = [
            "id" => (int)$row['job_id'],
            "job_no" => (string)$row['job_no'],
            "order_id" => (int)$row['main_order_id'],
            "sub_order_id" => (int)$row['sub_order_id'],
            "vendor_id" => (int)$row['vendor_id'],
            "custom_order_id" => "JOB-" . $row['job_no'],
            "status" => strtoupper((string)$row['job_status']),
            "payout_amount" => number_format($payout, 2, '.', ''),
            "estimated_distance" => number_format((float)$row['estimated_distance'], 1, '.', ''),
            "created_at" => $row['job_created_at'],
            "restaurant_name" => $row['restaurant_name'] ?: 'MTB Grocery Store',
            "to_pay" => number_format($to_pay, 2, '.', ''),
            "payment_method" => $row['payment_method'] ?: 'COD',
            "delivery_address" => $delivery_addr ?: 'Customer Address',
            "restaurant_address" => $formatted_vendor_address,
            "restaurant_city" => $vendor_city,
            "user_name" => $customer_name,
            "user_phone" => $customer_phone,
            "delivery_instructions" => "",
            "restaurant_latitude" => null,
            "restaurant_longitude" => null,
            "user_latitude" => $row['user_latitude'],
            "user_longitude" => $row['user_longitude'],
            "delivered_at" => $row['job_delivered_at'],
            "items" => $items
        ];
    }

    echo json_encode([
        "success" => true,
        "partner" => [
            "id" => $partner_id,
            "name" => $partner['name'],
            "partner_type" => $partner_type,
            "vendor_id" => $partner_vendor_id,
            "current_rate" => number_format($partner_rate, 2, '.', ''),
            "commission_details" => [
                "commission_type" => $comm_type,
                "commission_rate" => $comm_rate,
                "min_commission_amount" => $min_comm
            ]
        ],
        "jobs" => $jobs
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
