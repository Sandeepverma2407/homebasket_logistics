<?php
require_once __DIR__ . '/../../connection/config.php';

header('Content-Type: application/json; charset=utf-8');

// Support both GET query and POST JSON
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true) ?: [];
} else {
    $input = $_GET;
}

$partner_id = isset($input['partner_id']) ? (int)$input['partner_id'] : 0;
if ($partner_id <= 0) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Valid Partner ID is required."]);
    exit;
}

$period = isset($input['period']) ? strtolower(trim($input['period'])) : 'all';
$custom_start = isset($input['start_date']) ? trim($input['start_date']) : null;
$custom_end = isset($input['end_date']) ? trim($input['end_date']) : null;

try {
    // 1. Calculate Date Filters
    $today = date('Y-m-d');
    $where_date_clause = "";
    $params = [$partner_id];
    $date_range_label = "All Time";

    if ($period === 'today') {
        $where_date_clause = "AND DATE(COALESCE(dj.delivered_at, dj.updated_at)) = ?";
        $params[] = $today;
        $date_range_label = "Today (" . date('d M Y') . ")";
    } elseif ($period === 'yesterday') {
        $yesterday = date('Y-m-d', strtotime('-1 day'));
        $where_date_clause = "AND DATE(COALESCE(dj.delivered_at, dj.updated_at)) = ?";
        $params[] = $yesterday;
        $date_range_label = "Yesterday (" . date('d M Y', strtotime('-1 day')) . ")";
    } elseif ($period === 'week') {
        $week_start = date('Y-m-d', strtotime('-6 days'));
        $where_date_clause = "AND DATE(COALESCE(dj.delivered_at, dj.updated_at)) BETWEEN ? AND ?";
        $params[] = $week_start;
        $params[] = $today;
        $date_range_label = date('d M', strtotime($week_start)) . " - " . date('d M Y');
    } elseif ($period === 'month') {
        $month_start = date('Y-m-01');
        $where_date_clause = "AND DATE(COALESCE(dj.delivered_at, dj.updated_at)) BETWEEN ? AND ?";
        $params[] = $month_start;
        $params[] = $today;
        $date_range_label = date('d M', strtotime($month_start)) . " - " . date('d M Y');
    } elseif ($period === 'custom') {
        if (!empty($custom_start) && !empty($custom_end)) {
            $where_date_clause = "AND DATE(COALESCE(dj.delivered_at, dj.updated_at)) BETWEEN ? AND ?";
            $params[] = $custom_start;
            $params[] = $custom_end;
            $date_range_label = date('d M Y', strtotime($custom_start)) . " - " . date('d M Y', strtotime($custom_end));
        } elseif (!empty($custom_start)) {
            $where_date_clause = "AND DATE(COALESCE(dj.delivered_at, dj.updated_at)) >= ?";
            $params[] = $custom_start;
            $date_range_label = "From " . date('d M Y', strtotime($custom_start));
        }
    }

    // 2. Fetch Delivered Jobs for Partner
    $sql = "
        SELECT 
            dj.id as job_id,
            dj.job_no,
            dj.main_order_id,
            dj.sub_order_id,
            dj.earning,
            dj.estimated_distance,
            dj.status as job_status,
            dj.accepted_at,
            dj.picked_up_at,
            dj.delivered_at,
            dj.updated_at,
            v.shop_name,
            v.address as vendor_address,
            o.order_no,
            o.payment_method,
            o.total_amount as order_total_amount,
            DATE(COALESCE(dj.delivered_at, dj.updated_at)) as tx_date,
            DAYNAME(COALESCE(dj.delivered_at, dj.updated_at)) as tx_day,
            DATE_FORMAT(COALESCE(dj.delivered_at, dj.updated_at), '%h:%i %p') as tx_time
        FROM delivery_jobs dj
        LEFT JOIN admin_vendors v ON dj.vendor_id = v.id
        LEFT JOIN app_orders o ON dj.main_order_id = o.id
        WHERE dj.delivery_boy_id = ? 
          AND LOWER(dj.status) = 'delivered'
          {$where_date_clause}
        ORDER BY COALESCE(dj.delivered_at, dj.updated_at) DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Process Transactions & Group by Day/Date
    $total_earnings = 0.0;
    $total_cod_collected = 0.0;
    $total_trips = count($rows);

    $grouped_map = [];
    $raw_transactions = [];

    $yesterday_str = date('Y-m-d', strtotime('-1 day'));

    foreach ($rows as $row) {
        $earning = (float)($row['earning'] ?? 0);
        $total_earnings += $earning;

        $is_cod = strtoupper(trim((string)($row['payment_method'] ?? ''))) === 'COD';
        $cod_amt = 0.0;
        if ($is_cod) {
            $cod_amt = (float)($row['order_total_amount'] ?? 0);
            $total_cod_collected += $cod_amt;
        }

        $tx_date = $row['tx_date'] ?: date('Y-m-d');
        $tx_day = $row['tx_day'] ?: date('l');
        $tx_time = $row['tx_time'] ?: date('h:i A');

        $relative_day = null;
        if ($tx_date === $today) {
            $relative_day = 'Today';
        } elseif ($tx_date === $yesterday_str) {
            $relative_day = 'Yesterday';
        }

        $item = [
            "job_id" => (int)$row['job_id'],
            "job_no" => $row['job_no'],
            "main_order_id" => (int)$row['main_order_id'],
            "order_no" => $row['order_no'] ?: ("#" . $row['job_no']),
            "shop_name" => $row['shop_name'] ?: "Store Vendor",
            "earning" => number_format($earning, 2, '.', ''),
            "is_cod" => $is_cod,
            "cod_amount" => number_format($cod_amt, 2, '.', ''),
            "payment_method" => $is_cod ? 'COD' : ($row['payment_method'] ?: 'Online'),
            "distance" => number_format((float)($row['estimated_distance'] ?? 0), 1, '.', '') . " km",
            "date" => $tx_date,
            "display_date" => date('d M Y', strtotime($tx_date)),
            "day_name" => $tx_day,
            "relative_day" => $relative_day,
            "time" => $tx_time,
            "timestamp" => $row['delivered_at'] ?: $row['updated_at'],
            "status" => "DELIVERED"
        ];

        $raw_transactions[] = $item;

        // Grouping
        if (!isset($grouped_map[$tx_date])) {
            $grouped_map[$tx_date] = [
                "date" => $tx_date,
                "display_date" => date('d M Y', strtotime($tx_date)),
                "day_name" => $tx_day,
                "relative_day" => $relative_day,
                "day_total_earnings" => 0.0,
                "day_trips_count" => 0,
                "day_cod_collected" => 0.0,
                "items" => []
            ];
        }

        $grouped_map[$tx_date]["day_total_earnings"] += $earning;
        $grouped_map[$tx_date]["day_trips_count"] += 1;
        $grouped_map[$tx_date]["day_cod_collected"] += $cod_amt;
        $grouped_map[$tx_date]["items"][] = $item;
    }

    // Format grouped list
    $grouped_transactions = [];
    foreach ($grouped_map as $date_key => $g) {
        $g["day_total_earnings"] = number_format($g["day_total_earnings"], 2, '.', '');
        $g["day_cod_collected"] = number_format($g["day_cod_collected"], 2, '.', '');
        $grouped_transactions[] = $g;
    }

    echo json_encode([
        "success" => true,
        "period" => $period,
        "date_range_label" => $date_range_label,
        "summary" => [
            "total_earnings" => number_format($total_earnings, 2, '.', ''),
            "total_trips" => $total_trips,
            "total_cod_collected" => number_format($total_cod_collected, 2, '.', '')
        ],
        "grouped_transactions" => $grouped_transactions,
        "raw_transactions" => $raw_transactions
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
