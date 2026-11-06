<?php
require_once __DIR__ . '/../../connection/config.php';
require_once __DIR__ . '/../../connection/settlement_helper.php';

/**
 * One Delivery PIN per main order. Created the first time a delivery job of that order is worked on and
 * shared by all its (not yet finished) sub-order jobs, so the customer sees a single PIN in the app.
 * Always returns the PIN that is now stored for the order.
 */
function ensure_delivery_pin(PDO $pdo, array $job): string
{
    $main_order_id = (int)($job['main_order_id'] ?? 0);
    $scope = $main_order_id > 0 ? 'main_order_id = ?' : 'id = ?';
    $scope_value = $main_order_id > 0 ? $main_order_id : (int)$job['id'];
    $active = "LOWER(status) NOT IN ('delivered', 'cancelled')";

    $sel = $pdo->prepare("SELECT delivery_otp FROM delivery_jobs WHERE {$scope} AND {$active} AND delivery_otp IS NOT NULL AND TRIM(delivery_otp) <> '' LIMIT 1");
    $sel->execute([$scope_value]);
    $pin = trim((string)$sel->fetchColumn());
    if ($pin === '') {
        $pin = str_pad((string)random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
    }

    $upd = $pdo->prepare("UPDATE delivery_jobs SET delivery_otp = ? WHERE {$scope} AND {$active} AND (delivery_otp IS NULL OR TRIM(delivery_otp) = '')");
    $upd->execute([$pin, $scope_value]);

    // Return what is actually stored (a concurrent request may have filled it first)
    $sel->execute([$scope_value]);
    $stored = trim((string)$sel->fetchColumn());

    return $stored !== '' ? $stored : $pin;
}

// Get POST input
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['partner_id']) || !isset($data['job_id']) || !isset($data['status'])) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Partner ID, Job ID, and Status are required."]);
    exit;
}

$partner_id = (int)$data['partner_id'];
$job_id = (int)$data['job_id'];
$new_status_raw = trim($data['status']);
$new_status = strtoupper($new_status_raw);

// Allowed status transitions
$allowed_statuses = ['ACCEPTED', 'AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED', 'CANCELLED'];
if (!in_array($new_status, $allowed_statuses)) {
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Invalid status value: " . $new_status]);
    exit;
}

try {
    // Start transaction
    $pdo->beginTransaction();

    // 1. Fetch partner details
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

    $current_db_status = strtolower($job['status']);

    // 3. Concurrency & Authorization checks
    if ($new_status === 'ACCEPTED') {
        if (!empty($job['delivery_boy_id']) && (int)$job['delivery_boy_id'] !== 0 && (int)$job['delivery_boy_id'] !== $partner_id) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "This order has already been accepted by another partner."]);
            exit;
        }
        if ($current_db_status !== 'pending' && (int)$job['delivery_boy_id'] !== $partner_id) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "This order is not in PENDING state."]);
            exit;
        }

        // Fleet validation check
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
            if ($partner['partner_type'] !== 'Vendor' || (int)$partner['vendor_id'] !== (int)$job['vendor_id']) {
                $pdo->rollBack();
                echo json_encode(["success" => false, "message" => "Unauthorized: This order is fulfilled exclusively by the vendor's self-delivery fleet."]);
                exit;
            }
        } else {
            if ($partner['partner_type'] === 'Vendor' && !empty($partner['vendor_id'])) {
                $pdo->rollBack();
                echo json_encode(["success" => false, "message" => "Unauthorized: This order is fulfilled exclusively by Centralized Delivery partners."]);
                exit;
            }
        }
    } else {
        if ((int)$job['delivery_boy_id'] !== $partner_id) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "Unauthorized: This job is assigned to another partner."]);
            exit;
        }
    }

    // Enforce that a job cannot be updated once DELIVERED or CANCELLED
    if ($current_db_status === 'delivered' || $current_db_status === 'cancelled') {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "This order is already completed or cancelled."]);
        exit;
    }

    // OTP Verification for PICKED_UP and DELIVERED
    if ($new_status === 'PICKED_UP') {
        if (!empty($job['pickup_otp'])) {
            $provided_otp = trim((string)($data['otp_code'] ?? ''));
            if ($provided_otp !== trim((string)$job['pickup_otp'])) {
                $pdo->rollBack();
                echo json_encode(["success" => false, "message" => "Invalid store pickup OTP. Please verify with the store coordinator."]);
                exit;
            }
        }
    } elseif ($new_status === 'DELIVERED') {
        if (trim((string)($job['delivery_otp'] ?? '')) === '') {
            // A delivery must never be completed without a PIN. Create it now (so the customer can read it in
            // the app) and keep that change, then ask the partner to try again with the customer's PIN.
            ensure_delivery_pin($pdo, $job);
            $pdo->commit();
            echo json_encode([
                "success" => false,
                "message" => "Delivery PIN was not generated for this order yet. It has been created now and is visible to the customer in the Mtb app. Ask the customer for the 4-digit PIN and try again."
            ]);
            exit;
        }
        $provided_otp = trim((string)($data['otp_code'] ?? ''));
        if ($provided_otp !== trim((string)$job['delivery_otp'])) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "Invalid customer delivery OTP. Please verify with the customer."]);
            exit;
        }
    }

    // Payout amount
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

    // 4. Update delivery_jobs status & handle OTP generation / clearing
    $target_status = strtolower($new_status);
    $extra_job_sql = "";
    $generated_otp_info = null;

    // The customer's Delivery PIN exists from the moment a partner works on the job (not only at
    // "out for delivery"), so it is always available in the customer app. One PIN per main order.
    if ($new_status !== 'CANCELLED' && $new_status !== 'DELIVERED') {
        $delivery_pin = ensure_delivery_pin($pdo, $job);
    }

    if ($new_status === 'ACCEPTED') {
        $pickup_otp = !empty($job['pickup_otp']) ? $job['pickup_otp'] : str_pad((string)random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
        $extra_job_sql = ", pickup_otp = '{$pickup_otp}', accepted_at = NOW()";
        $generated_otp_info = $pickup_otp;
    } elseif ($new_status === 'PICKED_UP') {
        $extra_job_sql = ", picked_up_at = NOW(), pickup_otp = NULL";
    } elseif ($new_status === 'OUT_FOR_DELIVERY') {
        // Reuse the PIN the customer already sees; never replace it with a new random one
        $generated_otp_info = $delivery_pin;
    } elseif ($new_status === 'DELIVERED') {
        $extra_job_sql = ", delivered_at = NOW(), delivery_otp = NULL";
    }

    $update_stmt = $pdo->prepare("UPDATE delivery_jobs SET status = ?, delivery_boy_id = ?, earning = ? {$extra_job_sql}, updated_at = NOW() WHERE id = ?");
    $update_stmt->execute([$target_status, $partner_id, $payout_amount, $job_id]);

    // 5. Sync app_sub_orders, app_orders, and app_order_status
    $sub_order_id = (int)($job['sub_order_id'] ?? 0);
    $main_order_id = (int)($job['main_order_id'] ?? 0);
    $vendor_id = (int)($job['vendor_id'] ?? 0);

    // Resolve main_order_id and vendor_id from sub_order if needed
    if ($main_order_id <= 0 && $sub_order_id > 0) {
        $sub_info_stmt = $pdo->prepare("SELECT main_order_id, vendor_id FROM app_sub_orders WHERE id = ?");
        $sub_info_stmt->execute([$sub_order_id]);
        if ($sub_info = $sub_info_stmt->fetch(PDO::FETCH_ASSOC)) {
            $main_order_id = (int)$sub_info['main_order_id'];
            if ($vendor_id <= 0) $vendor_id = (int)$sub_info['vendor_id'];
        }
    }

    // Fetch main order details
    $order = null;
    $order_no = '';
    if ($main_order_id > 0) {
        $order_stmt = $pdo->prepare("SELECT id, order_no, user_id, status, total_amount, payment_method, payment_details FROM app_orders WHERE id = ? FOR UPDATE");
        $order_stmt->execute([$main_order_id]);
        $order = $order_stmt->fetch(PDO::FETCH_ASSOC);
        if ($order) {
            $order_no = trim($order['order_no'] ?? '');
        }
    }

    // A. Sync vendor sub-orders in app_sub_orders
    $sub_target_status = null;
    if ($new_status === 'PICKED_UP') {
        $sub_target_status = 'picked';
    } elseif ($new_status === 'OUT_FOR_DELIVERY') {
        $sub_target_status = 'out_for_delivery';
    } elseif ($new_status === 'DELIVERED') {
        $sub_target_status = 'delivered';
    } elseif ($new_status === 'CANCELLED') {
        $sub_target_status = 'cancelled';
    }

    if ($sub_target_status) {
        if ($sub_order_id > 0) {
            $sub_update = $pdo->prepare("UPDATE app_sub_orders SET status = ?, delivery_boy_id = ?, updated_at = NOW() WHERE id = ?");
            $sub_update->execute([$sub_target_status, $partner_id, $sub_order_id]);
        } elseif ($main_order_id > 0) {
            $sub_update = $pdo->prepare("UPDATE app_sub_orders SET status = ?, delivery_boy_id = ?, updated_at = NOW() WHERE main_order_id = ? AND LOWER(status) != 'cancelled'");
            $sub_update->execute([$sub_target_status, $partner_id, $main_order_id]);
        }

        // Add timeline entry safely without blocking the transaction
        if ($sub_order_id > 0) {
            try {
                $timeline_stmt = $pdo->prepare("
                    INSERT INTO sub_order_status_timeline 
                    (sub_order_id, main_order_id, vendor_id, previous_status, new_status, updated_by_role, updated_by_id, remarks, created_at)
                    VALUES (?, ?, ?, ?, ?, 'delivery_boy', ?, ?, NOW())
                ");
                $timeline_stmt->execute([$sub_order_id, $main_order_id, $vendor_id, $job['status'], $sub_target_status, $partner_id, "Updated to {$new_status} by delivery partner"]);
            } catch (Exception $tl_e) {
                error_log("sub_order_status_timeline insert error: " . $tl_e->getMessage());
            }
        }
    }

    // B. Sync main order in app_orders and insert timeline milestone in app_order_status
    if ($main_order_id > 0 && !empty($order_no)) {
        if ($new_status === 'ACCEPTED') {
            // Assign delivery_boy_id to app_orders if not already set
            $pdo->prepare("UPDATE app_orders SET delivery_boy_id = ?, updated_at = NOW() WHERE id = ? AND (delivery_boy_id IS NULL OR delivery_boy_id = 0)")
                ->execute([$partner_id, $main_order_id]);
        } elseif ($new_status === 'OUT_FOR_DELIVERY') {
            // Update main order status to out_for_delivery
            $ord_update = $pdo->prepare("UPDATE app_orders SET status = 'out_for_delivery', delivery_boy_id = ?, updated_at = NOW() WHERE id = ?");
            $ord_update->execute([$partner_id, $main_order_id]);

            // Insert tracking milestone in app_order_status (idempotent)
            $check_status = $pdo->prepare("SELECT id FROM app_order_status WHERE order_id = ? AND status = 'out_for_delivery' LIMIT 1");
            $check_status->execute([$main_order_id]);
            if (!$check_status->fetch()) {
                $ins_status = $pdo->prepare("
                    INSERT INTO app_order_status (order_id, order_no, status, title, description, created_at)
                    VALUES (?, ?, 'out_for_delivery', 'Out for Delivery', 'Our delivery executive is on the way with your order.', NOW())
                ");
                $ins_status->execute([$main_order_id, $order_no]);
            }
        } elseif ($new_status === 'DELIVERED') {
            // Check if all active sub-orders for this main order are now delivered
            $pending_subs_stmt = $pdo->prepare("
                SELECT COUNT(*) FROM app_sub_orders 
                WHERE main_order_id = ? AND LOWER(status) NOT IN ('delivered', 'cancelled')
            ");
            $pending_subs_stmt->execute([$main_order_id]);
            $pending_subs_count = (int)$pending_subs_stmt->fetchColumn();

            if ($pending_subs_count === 0) {
                $ord_update = $pdo->prepare("UPDATE app_orders SET status = 'delivered', delivery_boy_id = ?, updated_at = NOW() WHERE id = ?");
                $ord_update->execute([$partner_id, $main_order_id]);
            }

            // Insert tracking milestone in app_order_status (idempotent)
            $check_status = $pdo->prepare("SELECT id FROM app_order_status WHERE order_id = ? AND status = 'delivered' LIMIT 1");
            $check_status->execute([$main_order_id]);
            if (!$check_status->fetch()) {
                $ins_status = $pdo->prepare("
                    INSERT INTO app_order_status (order_id, order_no, status, title, description, created_at)
                    VALUES (?, ?, 'delivered', 'Delivered', 'Your order has been successfully delivered. Thank you!', NOW())
                ");
                $ins_status->execute([$main_order_id, $order_no]);
            }
        }
    }

    // 6. Log entry in delivery_job_logs
    $remarks = isset($data['remarks']) ? trim($data['remarks']) : "Job status updated to {$new_status}";
    $log_stmt = $pdo->prepare("
        INSERT INTO delivery_job_logs 
        (job_id, sub_order_id, delivery_boy_id, previous_status, new_status, remarks, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ");
    $log_stmt->execute([$job_id, $sub_order_id, $partner_id, $job['status'], $target_status, $remarks]);

    // 7. If DELIVERED: Automatic Wallet Accounting for Earning & COD Cash Collection
    if ($new_status === 'DELIVERED') {
        // A. Credit Trip Earning to Partner Wallet & Partner_Ledger
        if ($payout_amount > 0) {
            SettlementHelper::recordPartnerFinancialTransaction(
                $pdo,
                $partner_id,
                'DELIVERY_EARNING',
                $payout_amount,
                $main_order_id,
                'success'
            );
        }

        // B. Handle COD Collection if Order was Cash on Delivery
        if ($order && strtoupper(trim($order['payment_method'])) === 'COD') {
            // Full complete customer invoice amount including all charges & delivery fees from app_orders.total_amount
            $cod_amount = (float)$order['total_amount'];

            if ($cod_amount > 0) {
                SettlementHelper::recordPartnerFinancialTransaction(
                    $pdo,
                    $partner_id,
                    'COD_COLLECTED',
                    $cod_amount,
                    $main_order_id,
                    'success'
                );
            }

            // Update payment details in app_orders
            $payment_details = [];
            if (!empty($order['payment_details'])) {
                $decoded = json_decode($order['payment_details'], true);
                if (is_array($decoded)) $payment_details = $decoded;
            }
            $payment_details['status'] = 'Paid';
            $payment_details['collected_by_partner'] = $partner_id;
            $payment_details['collected_at'] = date('Y-m-d H:i:s');
            $payment_details['amount_collected'] = $cod_amount;

            $order_update = $pdo->prepare("UPDATE app_orders SET payment_details = ?, updated_at = NOW() WHERE id = ?");
            $order_update->execute([json_encode($payment_details, JSON_UNESCAPED_UNICODE), $main_order_id]);
        }
    }

    // Commit transaction
    $pdo->commit();

    $response_data = [
        "success" => true,
        "message" => "Status updated to " . $new_status . " successfully!",
        "status" => $new_status,
        "payout_amount" => number_format($payout_amount, 2, '.', '')
    ];
    if ($generated_otp_info !== null) {
        $response_data["generated_otp"] = $generated_otp_info;
    }

    echo json_encode($response_data);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(200);
    echo json_encode(["success" => false, "message" => "Server error: " . $e->getMessage()]);
}
?>
