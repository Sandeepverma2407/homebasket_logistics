<?php
/**
 * Reset all orders, delivery jobs, sub-orders, checklists, logs, and partner wallets
 * back to clean initial state ("Order Placed" / "pending").
 */
require_once __DIR__ . '/../connection/config.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== MTB STORE / ALLIVO GROCERY ORDER RESET UTILITY ===\n\n";

try {
    $pdo->beginTransaction();

    // 1. Reset app_orders
    echo "1. Resetting main orders in app_orders...\n";
    $stmt1 = $pdo->prepare("
        UPDATE app_orders 
        SET status = 'pending', 
            delivery_boy_id = NULL,
            payment_details = CASE 
                WHEN UPPER(TRIM(payment_method)) = 'COD' THEN NULL 
                ELSE payment_details 
            END,
            updated_at = NOW()
    ");
    $stmt1->execute();
    echo "   -> Updated " . $stmt1->rowCount() . " rows in app_orders to 'pending'.\n\n";

    // 2. Reset app_sub_orders
    echo "2. Resetting vendor sub-orders in app_sub_orders...\n";
    $stmt2 = $pdo->prepare("
        UPDATE app_sub_orders 
        SET status = 'pending', 
            delivery_boy_id = NULL, 
            settlement_status = 'unsettled',
            updated_at = NOW()
    ");
    $stmt2->execute();
    echo "   -> Updated " . $stmt2->rowCount() . " rows in app_sub_orders to 'pending'.\n\n";

    // 3. Reset delivery_jobs
    echo "3. Resetting delivery jobs in delivery_jobs...\n";
    $stmt3 = $pdo->prepare("
        UPDATE delivery_jobs 
        SET status = 'pending', 
            delivery_boy_id = NULL, 
            pickup_otp = NULL, 
            delivery_otp = NULL, 
            accepted_at = NULL, 
            picked_up_at = NULL, 
            delivered_at = NULL, 
            updated_at = NOW()
    ");
    $stmt3->execute();
    echo "   -> Updated " . $stmt3->rowCount() . " rows in delivery_jobs to 'pending' (all OTPs and timestamps cleared).\n\n";

    // 4. Reset app_order_items (is_picked)
    echo "4. Resetting item checklists in app_order_items...\n";
    $stmt4 = $pdo->prepare("UPDATE app_order_items SET is_picked = 0");
    $stmt4->execute();
    echo "   -> Reset is_picked = 0 across " . $stmt4->rowCount() . " order items.\n\n";

    // 5. Clear transition logs and audit timeline tables
    echo "5. Deleting transition logs and timeline history...\n";
    $pdo->exec("DELETE FROM delivery_job_logs");
    echo "   -> delivery_job_logs cleared.\n";
    $pdo->exec("DELETE FROM sub_order_status_timeline");
    echo "   -> sub_order_status_timeline cleared.\n";
    $pdo->exec("DELETE FROM settlement_orders");
    echo "   -> settlement_orders cleared.\n\n";

    // 6. Reset partner financial ledger and settlements
    echo "6. Resetting partner financial ledgers and settlement requests...\n";
    $pdo->exec("DELETE FROM Partner_Ledger");
    echo "   -> Partner_Ledger cleared.\n";
    $pdo->exec("DELETE FROM delivery_partner_settlements");
    echo "   -> delivery_partner_settlements cleared.\n\n";

    // 7. Reset delivery partner wallets
    echo "7. Recalibrating delivery partner wallets to zero...\n";
    $now = date('Y-m-d H:i:s');
    $zeroWallet = json_encode([
        "total_earnings"      => 0,
        "balance"             => 0,
        "cash_in_hand"        => 0,
        "total_withdrawals"   => 0,
        "total_deposits"      => 0,
        "pending_withdrawals" => 0,
        "updated_at"          => $now
    ], JSON_UNESCAPED_UNICODE);

    $stmt7 = $pdo->prepare("UPDATE delivery_partners SET wallet = ?");
    $stmt7->execute([$zeroWallet]);
    echo "   -> Reset wallet for " . $stmt7->rowCount() . " delivery partners.\n\n";

    // 8. Re-seed clean initial 'placed' status for all orders in app_order_status
    echo "8. Re-seeding initial 'Order Placed' status in app_order_status...\n";
    $pdo->exec("DELETE FROM app_order_status");
    $stmt8 = $pdo->prepare("
        INSERT INTO app_order_status 
        (order_id, order_no, status, title, description, created_at)
        SELECT id, order_no, 'placed', 'Order Placed', 'Your order has been placed successfully and is pending confirmation.', NOW()
        FROM app_orders
    ");
    $stmt8->execute();
    echo "   -> Inserted initial 'placed' status for " . $stmt8->rowCount() . " orders.\n\n";

    if ($pdo->inTransaction()) {
        $pdo->commit();
    }

    echo "=======================================================\n";
    echo "SUCCESS: ALL ORDERS AND RELATED SYSTEMS RESET PROPERLY!\n";
    echo "=======================================================\n";

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "\n[ERROR]: Order reset failed: " . $e->getMessage() . "\n";
    exit(1);
}
