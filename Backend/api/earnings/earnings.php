<?php
require_once __DIR__ . '/../../connection/config.php';

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data) || !isset($data['partner_id'])) {
    if (isset($_POST['partner_id'])) {
        $data = $_POST;
    }
}

if (!isset($data['partner_id'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Partner ID is required."]);
    exit;
}

$partner_id = (int)$data['partner_id'];
$period = isset($data['period']) ? $data['period'] : 'weekly';

try {
    // 1. Fetch partner record from delivery_partners
    $dp_stmt = $pdo->prepare("SELECT id, name, wallet, commission_details FROM delivery_partners WHERE id = ? AND trash = 0 LIMIT 1");
    $dp_stmt->execute([$partner_id]);
    $partner = $dp_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$partner) {
        http_response_code(200);
        echo json_encode(["success" => false, "message" => "Delivery partner not found."]);
        exit;
    }

    $comm_details = !empty($partner['commission_details']) ? json_decode($partner['commission_details'], true) : [];
    if (!is_array($comm_details)) {
        $comm_details = [];
    }
    $comm_type = (isset($comm_details['commission_type']) && in_array($comm_details['commission_type'], ['fixed', 'distance'])) ? $comm_details['commission_type'] : 'fixed';
    $comm_rate = isset($comm_details['commission_rate']) ? (float)$comm_details['commission_rate'] : 20.00;
    $min_comm = isset($comm_details['min_commission_amount']) ? (float)$comm_details['min_commission_amount'] : ($comm_type === 'fixed' ? $comm_rate : 20.00);

    $wallet_data = !empty($partner['wallet']) ? json_decode($partner['wallet'], true) : [];
    if (!is_array($wallet_data)) {
        $wallet_data = [];
    }

    // 2. Fetch sum of delivery earnings from delivery_jobs
    $stmt_earn_hist = $pdo->prepare("SELECT COALESCE(SUM(earning), 0) 
                                     FROM delivery_jobs 
                                     WHERE delivery_boy_id = ? AND LOWER(status) = 'delivered'");
    $stmt_earn_hist->execute([$partner_id]);
    $total_earnings_history = (float)$stmt_earn_hist->fetchColumn();

    $total_earnings = isset($wallet_data['balance']) ? (float)$wallet_data['balance'] : $total_earnings_history;

    // 3. Fetch delivered online orders value & total delivered order amount
    $stmt_online_orders = $pdo->prepare("
        SELECT COALESCE(SUM(o.total_amount), 0) 
        FROM delivery_jobs dj
        JOIN app_orders o ON dj.main_order_id = o.id
        WHERE dj.delivery_boy_id = ? 
          AND LOWER(dj.status) = 'delivered' 
          AND UPPER(TRIM(o.payment_method)) != 'COD'
    ");
    $stmt_online_orders->execute([$partner_id]);
    $online_order_amount = (float)$stmt_online_orders->fetchColumn();

    $stmt_total_orders = $pdo->prepare("
        SELECT COALESCE(SUM(o.total_amount), 0) 
        FROM delivery_jobs dj
        JOIN app_orders o ON dj.main_order_id = o.id
        WHERE dj.delivery_boy_id = ? AND LOWER(dj.status) = 'delivered'
    ");
    $stmt_total_orders->execute([$partner_id]);
    $total_delivered_order_amount = (float)$stmt_total_orders->fetchColumn();

    // 4. Fetch COD collected amount
    $stmt_cod = $pdo->prepare("
        SELECT COALESCE(SUM(o.total_amount), 0) 
        FROM delivery_jobs dj
        JOIN app_orders o ON dj.main_order_id = o.id
        WHERE dj.delivery_boy_id = ? 
          AND LOWER(dj.status) = 'delivered' 
          AND UPPER(TRIM(o.payment_method)) = 'COD'
    ");
    $stmt_cod->execute([$partner_id]);
    $cod_amount_collected = (float)$stmt_cod->fetchColumn();

    $cash_in_hand = isset($wallet_data['cash_in_hand']) ? (float)$wallet_data['cash_in_hand'] : $cod_amount_collected;

    // Fetch live pending settlements from delivery_partner_settlements
    $stmt_pwith = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM delivery_partner_settlements WHERE partner_id = ? AND settlement_type = 'withdrawal' AND status = 'pending'");
    $stmt_pwith->execute([$partner_id]);
    $pending_withdrawals = (float)$stmt_pwith->fetchColumn();

    $stmt_pdep = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM delivery_partner_settlements WHERE partner_id = ? AND settlement_type = 'deposit' AND status = 'pending'");
    $stmt_pdep->execute([$partner_id]);
    $pending_deposits = (float)$stmt_pdep->fetchColumn();

    $total_withdrawals = isset($wallet_data['total_withdrawals']) ? (float)$wallet_data['total_withdrawals'] : 0.00;
    $total_deposits = isset($wallet_data['total_deposits']) ? (float)$wallet_data['total_deposits'] : 0.00;

    $available_balance = isset($wallet_data['balance']) ? (float)$wallet_data['balance'] : max(0.00, $total_earnings_history - $pending_withdrawals - $total_withdrawals);
    $available_cash_in_hand = max(0.00, round($cash_in_hand - $pending_deposits, 2));

    // 5. Generate trend
    $weekly_trend = [];
    if ($period === 'monthly') {
        for ($i = 4; $i >= 0; $i--) {
            $start_date = date('Y-m-d 00:00:00', strtotime("-$i week monday"));
            $end_date = date('Y-m-d 23:59:59', strtotime("-$i week sunday"));
            $label = $i === 0 ? "This Wk" : "Wk " . (5 - $i);

            $stmt_w = $pdo->prepare("
                SELECT COALESCE(SUM(earning), 0) 
                FROM delivery_jobs 
                WHERE delivery_boy_id = ? 
                  AND LOWER(status) = 'delivered' 
                  AND updated_at BETWEEN ? AND ?
            ");
            $stmt_w->execute([$partner_id, $start_date, $end_date]);
            $w_amount = (float)$stmt_w->fetchColumn();

            $weekly_trend[] = [
                "label" => $label,
                "amount" => number_format($w_amount, 2, '.', '')
            ];
        }
    } elseif ($period === 'total') {
        for ($i = 5; $i >= 0; $i--) {
            $month_start = date('Y-m-01 00:00:00', strtotime("-$i month"));
            $month_end = date('Y-m-t 23:59:59', strtotime("-$i month"));
            $month_name = date('M', strtotime("-$i month"));

            $stmt_m = $pdo->prepare("
                SELECT COALESCE(SUM(earning), 0) 
                FROM delivery_jobs 
                WHERE delivery_boy_id = ? 
                  AND LOWER(status) = 'delivered' 
                  AND updated_at BETWEEN ? AND ?
            ");
            $stmt_m->execute([$partner_id, $month_start, $month_end]);
            $m_amount = (float)$stmt_m->fetchColumn();

            $weekly_trend[] = [
                "label" => $month_name,
                "amount" => number_format($m_amount, 2, '.', '')
            ];
        }
    } else {
        // Daily trend for the last 7 days
        for ($i = 6; $i >= 0; $i--) {
            $date = date('Y-m-d', strtotime("-$i days"));
            $day_name = date('D', strtotime("-$i days"));

            $stmt_d = $pdo->prepare("
                SELECT COALESCE(SUM(earning), 0) 
                FROM delivery_jobs 
                WHERE delivery_boy_id = ? 
                  AND LOWER(status) = 'delivered' 
                  AND DATE(updated_at) = ?
            ");
            $stmt_d->execute([$partner_id, $date]);
            $d_amount = (float)$stmt_d->fetchColumn();

            $weekly_trend[] = [
                "label" => $day_name,
                "amount" => number_format($d_amount, 2, '.', '')
            ];
        }
    }

    // 6. Recent activity from delivery_jobs
    $stmt_activity = $pdo->prepare("
        SELECT dj.id, dj.job_no, dj.earning, dj.updated_at, v.shop_name 
        FROM delivery_jobs dj
        LEFT JOIN admin_vendors v ON dj.vendor_id = v.id
        WHERE dj.delivery_boy_id = ? AND LOWER(dj.status) = 'delivered'
        ORDER BY dj.updated_at DESC 
        LIMIT 50
    ");
    $stmt_activity->execute([$partner_id]);
    $activities = $stmt_activity->fetchAll(PDO::FETCH_ASSOC);

    $recent_activity = [];
    foreach ($activities as $act) {
        $title = "Trip Earning #" . $act['job_no'] . ($act['shop_name'] ? " (" . $act['shop_name'] . ")" : "");
        $amount_str = number_format((float)$act['earning'], 2, '.', '');
        $formatted_date = date('d M, h:i A', strtotime($act['updated_at']));

        $recent_activity[] = [
            "id" => (string)$act['id'],
            "title" => $title,
            "date" => $formatted_date,
            "raw_date" => $act['updated_at'],
            "amount" => "+₹" . $amount_str,
            "status" => "SUCCESS"
        ];
    }

    // 7. Fetch live withdrawals and deposits from delivery_partner_settlements
    $stmt_with = $pdo->prepare("
        SELECT s.*, v.shop_name 
        FROM delivery_partner_settlements s
        LEFT JOIN admin_vendors v ON s.vendor_id = v.id
        WHERE s.partner_id = ? AND s.settlement_type = 'withdrawal'
        ORDER BY s.id DESC LIMIT 50
    ");
    $stmt_with->execute([$partner_id]);
    $with_rows = $stmt_with->fetchAll(PDO::FETCH_ASSOC);

    $withdrawals_list = [];
    foreach ($with_rows as $w) {
        $withdrawals_list[] = [
            "id" => (string)$w['id'],
            "settlement_no" => $w['settlement_no'],
            "settlement_type" => 'withdrawal',
            "amount" => number_format((float)$w['amount'], 2, '.', ''),
            "status" => strtoupper((string)$w['status']),
            "target_role" => $w['target_role'],
            "target" => $w['target_role'] === 'Vendor' ? ($w['shop_name'] ?: 'Store Vendor') : 'Admin',
            "target_name" => $w['target_role'] === 'Vendor' ? ($w['shop_name'] ?: 'Store Vendor') : 'Platform Admin',
            "date" => date('d M Y, h:i A', strtotime($w['requested_at'])),
            "requested_at" => $w['requested_at'],
            "processed_at" => !empty($w['processed_at']) ? date('d M Y, h:i A', strtotime($w['processed_at'])) : null,
            "approved_by_role" => $w['approved_by_role'] ?? null,
            "bank_details_snapshot" => $w['bank_details_snapshot'] ?? null,
            "payment_method" => $w['payment_method'] ?? '',
            "transaction_reference" => $w['transaction_reference'] ?? '',
            "admin_vendor_remarks" => $w['admin_vendor_remarks'] ?? '',
            "partner_remarks" => $w['partner_remarks'] ?? '',
            "proof_document" => $w['proof_document'] ?? null
        ];
    }

    $stmt_dep = $pdo->prepare("
        SELECT s.*, v.shop_name 
        FROM delivery_partner_settlements s
        LEFT JOIN admin_vendors v ON s.vendor_id = v.id
        WHERE s.partner_id = ? AND s.settlement_type = 'deposit'
        ORDER BY s.id DESC LIMIT 50
    ");
    $stmt_dep->execute([$partner_id]);
    $dep_rows = $stmt_dep->fetchAll(PDO::FETCH_ASSOC);

    $deposits_list = [];
    foreach ($dep_rows as $d) {
        $deposits_list[] = [
            "id" => (string)$d['id'],
            "settlement_no" => $d['settlement_no'],
            "settlement_type" => 'deposit',
            "amount" => number_format((float)$d['amount'], 2, '.', ''),
            "status" => strtoupper((string)$d['status']),
            "target_role" => $d['target_role'],
            "target" => $d['target_role'] === 'Vendor' ? ($d['shop_name'] ?: 'Store Vendor') : 'Admin',
            "target_name" => $d['target_role'] === 'Vendor' ? ($d['shop_name'] ?: 'Store Vendor') : 'Platform Admin',
            "date" => date('d M Y, h:i A', strtotime($d['requested_at'])),
            "requested_at" => $d['requested_at'],
            "processed_at" => !empty($d['processed_at']) ? date('d M Y, h:i A', strtotime($d['processed_at'])) : null,
            "approved_by_role" => $d['approved_by_role'] ?? null,
            "bank_details_snapshot" => $d['bank_details_snapshot'] ?? null,
            "payment_method" => $d['payment_method'] ?? '',
            "transaction_reference" => $d['transaction_reference'] ?? '',
            "admin_vendor_remarks" => $d['admin_vendor_remarks'] ?? '',
            "partner_remarks" => $d['partner_remarks'] ?? '',
            "proof_document" => $d['proof_document'] ?? null
        ];
    }

    echo json_encode([
        "success" => true,
        "balance" => number_format($available_balance, 2, '.', ''),
        "total_earnings" => number_format($available_balance, 2, '.', ''),
        "cash_in_hand" => number_format($cash_in_hand, 2, '.', ''),
        "available_cash_in_hand" => number_format($available_cash_in_hand, 2, '.', ''),
        "pending_withdrawals" => number_format($pending_withdrawals, 2, '.', ''),
        "pending_deposits" => number_format($pending_deposits, 2, '.', ''),
        "total_earnings_history" => number_format($total_earnings_history, 2, '.', ''),
        "online_order_amount" => number_format($online_order_amount, 2, '.', ''),
        "cod_amount_collected" => number_format($cod_amount_collected, 2, '.', ''),
        "total_withdrawals" => number_format($total_withdrawals, 2, '.', ''),
        "total_deposits" => number_format($total_deposits, 2, '.', ''),
        "total_delivered_order_amount" => number_format($total_delivered_order_amount, 2, '.', ''),
        "current_rate" => number_format($comm_rate, 2, '.', ''),
        "commission_details" => [
            "commission_type" => $comm_type,
            "commission_rate" => $comm_rate,
            "min_commission_amount" => $min_comm
        ],
        "weekly_trend" => $weekly_trend,
        "recent_activity" => $recent_activity,
        "withdrawals_list" => $withdrawals_list,
        "deposits_list" => $deposits_list
    ]);

} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
?>
