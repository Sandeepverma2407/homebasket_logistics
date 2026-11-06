<?php
/**
 * SettlementHelper
 * Enterprise delivery partner settlement processor for withdrawals & COD deposits
 */
class SettlementHelper {

    /**
     * Create a Partner Settlement Request (Withdrawal or COD Deposit)
     * Handles escrow hold on withdrawal requests to prevent double-spending
     */
    public static function createSettlementRequest($pdo, $partnerId, $type, $amount, $remarks = '') {
        $partnerId = (int)$partnerId;
        $amount = round((float)$amount, 2);
        $type = strtolower(trim($type));

        if ($partnerId <= 0 || $amount <= 0) {
            throw new Exception("Invalid partner ID or amount.");
        }
        if (!in_array($type, ['withdrawal', 'deposit'])) {
            throw new Exception("Invalid settlement type: must be 'withdrawal' or 'deposit'.");
        }

        // Lock partner record
        $stmt = $pdo->prepare("SELECT id, name, contact_no, partner_type, vendor_id, bank_details, wallet FROM delivery_partners WHERE id = ? AND trash = 0 FOR UPDATE");
        $stmt->execute([$partnerId]);
        $partner = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$partner) {
            throw new Exception("Delivery partner not found.");
        }

        $partnerType = !empty($partner['partner_type']) ? $partner['partner_type'] : 'Central';
        $vendorId = (int)($partner['vendor_id'] ?? 0);
        $targetRole = ($partnerType === 'Vendor' && $vendorId > 0) ? 'Vendor' : 'Admin';

        $wallet = !empty($partner['wallet']) ? json_decode($partner['wallet'], true) : [];
        if (!is_array($wallet)) $wallet = [];

        $totalEarnings = (float)($wallet['total_earnings'] ?? 0);
        $balance = (float)($wallet['balance'] ?? ($wallet['available_earnings'] ?? 0));
        $cashInHand = (float)($wallet['cash_in_hand'] ?? 0);
        $pendingWithdrawals = (float)($wallet['pending_withdrawals'] ?? 0);
        $pendingDeposits = (float)($wallet['pending_deposits'] ?? 0);
        $totalWithdrawals = (float)($wallet['total_withdrawals'] ?? 0);
        $totalDeposits = (float)($wallet['total_deposits'] ?? 0);

        // Query live pending amounts from delivery_partner_settlements table
        $pWithStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM delivery_partner_settlements WHERE partner_id = ? AND settlement_type = 'withdrawal' AND status = 'pending'");
        $pWithStmt->execute([$partnerId]);
        $livePendingWith = (float)$pWithStmt->fetchColumn();

        $pDepStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM delivery_partner_settlements WHERE partner_id = ? AND settlement_type = 'deposit' AND status = 'pending'");
        $pDepStmt->execute([$partnerId]);
        $livePendingDep = (float)$pDepStmt->fetchColumn();

        if ($type === 'withdrawal') {
            if ($amount > $balance) {
                $extraMsg = $livePendingWith > 0 ? " You currently have ₹" . number_format($livePendingWith, 2, '.', '') . " in pending withdrawal requests." : "";
                throw new Exception("Withdrawal amount (₹" . number_format($amount, 2, '.', '') . ") exceeds available wallet balance (₹" . number_format($balance, 2, '.', '') . ").{$extraMsg}");
            }
            // Escrow deduction: balance decreases, pending_withdrawals increases
            $balance = round($balance - $amount, 2);
            $pendingWithdrawals = round($livePendingWith + $amount, 2);

            $wallet['balance'] = $balance;
            $wallet['pending_withdrawals'] = $pendingWithdrawals;
            $wallet['total_earnings'] = round($totalEarnings, 2);
            $wallet['cash_in_hand'] = round($cashInHand, 2);
            $wallet['pending_deposits'] = round($livePendingDep, 2);
            $wallet['total_withdrawals'] = round($totalWithdrawals, 2);
            $wallet['total_deposits'] = round($totalDeposits, 2);
            $wallet['updated_at'] = date('Y-m-d H:i:s');

            @ini_set('serialize_precision', -1);
            $upStmt = $pdo->prepare("UPDATE delivery_partners SET wallet = ? WHERE id = ?");
            $upStmt->execute([json_encode($wallet, JSON_UNESCAPED_UNICODE), $partnerId]);
        } elseif ($type === 'deposit') {
            $availableCashToDeposit = max(0.00, round($cashInHand - $livePendingDep, 2));
            if ($amount > $availableCashToDeposit) {
                $extraMsg = $livePendingDep > 0 ? " You already have ₹" . number_format($livePendingDep, 2, '.', '') . " in pending deposit verification." : "";
                throw new Exception("Deposit amount (₹" . number_format($amount, 2, '.', '') . ") exceeds available cash to deposit (₹" . number_format($availableCashToDeposit, 2, '.', '') . ").{$extraMsg}");
            }
            // Update pending_deposits in wallet
            $pendingDeposits = round($livePendingDep + $amount, 2);
            $wallet['pending_deposits'] = $pendingDeposits;
            $wallet['balance'] = round($balance, 2);
            $wallet['pending_withdrawals'] = round($livePendingWith, 2);
            $wallet['total_earnings'] = round($totalEarnings, 2);
            $wallet['cash_in_hand'] = round($cashInHand, 2);
            $wallet['total_withdrawals'] = round($totalWithdrawals, 2);
            $wallet['total_deposits'] = round($totalDeposits, 2);
            $wallet['updated_at'] = date('Y-m-d H:i:s');

            @ini_set('serialize_precision', -1);
            $upStmt = $pdo->prepare("UPDATE delivery_partners SET wallet = ? WHERE id = ?");
            $upStmt->execute([json_encode($wallet, JSON_UNESCAPED_UNICODE), $partnerId]);
        }

        // Generate unique settlement number: DPS-YYYYMMDD-XXXXX
        $settlementNo = 'DPS-' . date('Ymd') . '-' . str_pad(mt_rand(1, 99999), 5, '0', STR_PAD_LEFT);

        $bankSnapshot = !empty($partner['bank_details']) ? $partner['bank_details'] : null;

        $insStmt = $pdo->prepare("
            INSERT INTO delivery_partner_settlements 
            (settlement_no, partner_id, partner_type, vendor_id, target_role, settlement_type, amount, status, bank_details_snapshot, partner_remarks, requested_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), NOW())
        ");
        $insStmt->execute([
            $settlementNo,
            $partnerId,
            $partnerType,
            $vendorId > 0 ? $vendorId : null,
            $targetRole,
            $type,
            $amount,
            $bankSnapshot,
            $remarks ?: null
        ]);

        $settlementId = $pdo->lastInsertId();

        return [
            'id' => (int)$settlementId,
            'settlement_no' => $settlementNo,
            'target_role' => $targetRole,
            'vendor_id' => $vendorId,
            'amount' => $amount,
            'type' => $type,
            'new_balance' => $balance,
            'cash_in_hand' => $cashInHand,
            'available_cash_to_deposit' => max(0.00, round($cashInHand - ($type === 'deposit' ? $pendingDeposits : $livePendingDep), 2)),
            'pending_withdrawals' => $pendingWithdrawals,
            'pending_deposits' => $pendingDeposits
        ];
    }

    /**
     * Approve a Partner Settlement Request
     * Finalizes wallet balances and writes an immutable Partner_Ledger entry
     */
    public static function approveSettlement($pdo, $settlementId, $approverId, $approverRole, $paymentMethod, $txnRef, $remarks = '', $proofDoc = null) {
        $settlementId = (int)$settlementId;
        $approverId = (int)$approverId;
        $approverRole = strtolower(trim($approverRole));

        if ($settlementId <= 0 || empty($paymentMethod)) {
            throw new Exception("Invalid settlement ID or payment method.");
        }

        // Lock settlement row
        $stmt = $pdo->prepare("SELECT * FROM delivery_partner_settlements WHERE id = ? FOR UPDATE");
        $stmt->execute([$settlementId]);
        $settlement = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$settlement) {
            throw new Exception("Settlement request not found.");
        }
        if ($settlement['status'] !== 'pending') {
            throw new Exception("Settlement is already " . strtoupper($settlement['status']) . ".");
        }

        // Vendor scope check: Vendors can only approve requests assigned to their vendor_id
        if ($approverRole === 'vendor') {
            if ((int)$settlement['vendor_id'] !== $approverId) {
                throw new Exception("Unauthorized: You can only approve settlements for your own delivery partners.");
            }
        }

        $partnerId = (int)$settlement['partner_id'];
        $amount = (float)$settlement['amount'];
        $type = $settlement['settlement_type'];

        // Lock partner row
        $pStmt = $pdo->prepare("SELECT id, name, contact_no, wallet FROM delivery_partners WHERE id = ? FOR UPDATE");
        $pStmt->execute([$partnerId]);
        $partner = $pStmt->fetch(PDO::FETCH_ASSOC);

        if (!$partner) {
            throw new Exception("Associated delivery partner not found.");
        }

        $wallet = !empty($partner['wallet']) ? json_decode($partner['wallet'], true) : [];
        if (!is_array($wallet)) $wallet = [];

        $totalEarnings = (float)($wallet['total_earnings'] ?? 0);
        $balance = (float)($wallet['balance'] ?? ($wallet['available_earnings'] ?? 0));
        $cashInHand = (float)($wallet['cash_in_hand'] ?? 0);
        $pendingWithdrawals = (float)($wallet['pending_withdrawals'] ?? 0);
        $totalWithdrawals = (float)($wallet['total_withdrawals'] ?? 0);
        $totalDeposits = (float)($wallet['total_deposits'] ?? 0);

        if ($type === 'withdrawal') {
            // Pending withdrawal finalized: pending_withdrawals decreases, total_withdrawals increases
            $pendingWithdrawals = max(0.00, round($pendingWithdrawals - $amount, 2));
            $totalWithdrawals = round($totalWithdrawals + $amount, 2);

            $wallet['pending_withdrawals'] = $pendingWithdrawals;
            $wallet['total_withdrawals'] = $totalWithdrawals;

            // Log into Partner_Ledger
            $ledgerStmt = $pdo->prepare("
                INSERT INTO Partner_Ledger 
                (partner_id, order_id, txn_type, amount, tnx_status, created_at, partner_name, partner_phone) 
                VALUES (?, NULL, 'WITHDRAWAL', ?, 'success', NOW(), ?, ?)
            ");
            $ledgerStmt->execute([$partnerId, $amount, $partner['name'] ?? null, $partner['contact_no'] ?? null]);

        } elseif ($type === 'deposit') {
            // Cash deposit confirmed: cash_in_hand decreases, total_deposits increases, pending_deposits decreases
            $cashInHand = max(0.00, round($cashInHand - $amount, 2));
            $totalDeposits = round($totalDeposits + $amount, 2);
            $pendingDeposits = max(0.00, round(($wallet['pending_deposits'] ?? $amount) - $amount, 2));

            $wallet['cash_in_hand'] = $cashInHand;
            $wallet['total_deposits'] = $totalDeposits;
            $wallet['pending_deposits'] = $pendingDeposits;

            // Log into Partner_Ledger
            $ledgerStmt = $pdo->prepare("
                INSERT INTO Partner_Ledger 
                (partner_id, order_id, txn_type, amount, tnx_status, created_at, partner_name, partner_phone) 
                VALUES (?, NULL, 'COD_DEPOSIT', ?, 'success', NOW(), ?, ?)
            ");
            $ledgerStmt->execute([$partnerId, $amount, $partner['name'] ?? null, $partner['contact_no'] ?? null]);
        }

        $wallet['updated_at'] = date('Y-m-d H:i:s');
        @ini_set('serialize_precision', -1);
        $upStmt = $pdo->prepare("UPDATE delivery_partners SET wallet = ? WHERE id = ?");
        $upStmt->execute([json_encode($wallet, JSON_UNESCAPED_UNICODE), $partnerId]);

        // Update settlement row
        $setStmt = $pdo->prepare("
            UPDATE delivery_partner_settlements 
            SET status = 'approved', 
                payment_method = ?, 
                transaction_reference = ?, 
                admin_vendor_remarks = ?, 
                proof_document = ?, 
                approved_by_id = ?, 
                approved_by_role = ?, 
                processed_at = NOW(), 
                updated_at = NOW() 
            WHERE id = ?
        ");
        $setStmt->execute([
            $paymentMethod,
            $txnRef ?: null,
            $remarks ?: null,
            $proofDoc ?: null,
            $approverId,
            $approverRole,
            $settlementId
        ]);

        return true;
    }

    /**
     * Reject a Partner Settlement Request
     * Restores held withdrawal funds back into available balance
     */
    public static function rejectSettlement($pdo, $settlementId, $approverId, $approverRole, $remarks = '') {
        $settlementId = (int)$settlementId;
        $approverId = (int)$approverId;
        $approverRole = strtolower(trim($approverRole));

        if ($settlementId <= 0) {
            throw new Exception("Invalid settlement ID.");
        }

        // Lock settlement row
        $stmt = $pdo->prepare("SELECT * FROM delivery_partner_settlements WHERE id = ? FOR UPDATE");
        $stmt->execute([$settlementId]);
        $settlement = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$settlement) {
            throw new Exception("Settlement request not found.");
        }
        if ($settlement['status'] !== 'pending') {
            throw new Exception("Settlement is already " . strtoupper($settlement['status']) . ".");
        }

        // Vendor scope check
        if ($approverRole === 'vendor') {
            if ((int)$settlement['vendor_id'] !== $approverId) {
                throw new Exception("Unauthorized: You can only reject settlements for your own delivery partners.");
            }
        }

        $partnerId = (int)$settlement['partner_id'];
        $amount = (float)$settlement['amount'];
        $type = $settlement['settlement_type'];

        // If withdrawal, restore held balance; if deposit, release held pending deposit
        $pStmt = $pdo->prepare("SELECT id, name, contact_no, wallet FROM delivery_partners WHERE id = ? FOR UPDATE");
        $pStmt->execute([$partnerId]);
        $partner = $pStmt->fetch(PDO::FETCH_ASSOC);

        if ($partner) {
            $wallet = !empty($partner['wallet']) ? json_decode($partner['wallet'], true) : [];
            if (!is_array($wallet)) $wallet = [];

            if ($type === 'withdrawal') {
                $balance = (float)($wallet['balance'] ?? ($wallet['available_earnings'] ?? 0));
                $pendingWithdrawals = (float)($wallet['pending_withdrawals'] ?? 0);

                // Refund held funds
                $balance = round($balance + $amount, 2);
                $pendingWithdrawals = max(0.00, round($pendingWithdrawals - $amount, 2));

                $wallet['balance'] = $balance;
                $wallet['pending_withdrawals'] = $pendingWithdrawals;
                $wallet['updated_at'] = date('Y-m-d H:i:s');

                @ini_set('serialize_precision', -1);
                $upStmt = $pdo->prepare("UPDATE delivery_partners SET wallet = ? WHERE id = ?");
                $upStmt->execute([json_encode($wallet, JSON_UNESCAPED_UNICODE), $partnerId]);

                // Log into Partner_Ledger
                $ledgerStmt = $pdo->prepare("
                    INSERT INTO Partner_Ledger 
                    (partner_id, order_id, txn_type, amount, tnx_status, created_at, partner_name, partner_phone) 
                    VALUES (?, NULL, 'WITHDRAWAL', ?, 'rejected', NOW(), ?, ?)
                ");
                $ledgerStmt->execute([$partnerId, $amount, $partner['name'] ?? null, $partner['contact_no'] ?? null]);
            } elseif ($type === 'deposit') {
                $pendingDeposits = max(0.00, round(($wallet['pending_deposits'] ?? $amount) - $amount, 2));
                $wallet['pending_deposits'] = $pendingDeposits;
                $wallet['updated_at'] = date('Y-m-d H:i:s');

                @ini_set('serialize_precision', -1);
                $upStmt = $pdo->prepare("UPDATE delivery_partners SET wallet = ? WHERE id = ?");
                $upStmt->execute([json_encode($wallet, JSON_UNESCAPED_UNICODE), $partnerId]);
            }
        }

        // Update settlement row
        $setStmt = $pdo->prepare("
            UPDATE delivery_partner_settlements 
            SET status = 'rejected', 
                admin_vendor_remarks = ?, 
                approved_by_id = ?, 
                approved_by_role = ?, 
                processed_at = NOW(), 
                updated_at = NOW() 
            WHERE id = ?
        ");
        $setStmt->execute([
            $remarks ?: 'Rejected by ' . ucfirst($approverRole),
            $approverId,
            $approverRole,
            $settlementId
        ]);

        return true;
    }

    /**
     * Query settlements with comprehensive joins and filtering
     */
    public static function getSettlements($pdo, $filters = []) {
        $where = ["1=1"];
        $params = [];

        if (!empty($filters['partner_id'])) {
            $where[] = "s.partner_id = ?";
            $params[] = (int)$filters['partner_id'];
        }

        if (!empty($filters['vendor_id'])) {
            $where[] = "s.vendor_id = ?";
            $params[] = (int)$filters['vendor_id'];
        }

        if (!empty($filters['target_role'])) {
            $where[] = "s.target_role = ?";
            $params[] = $filters['target_role'];
        }

        if (!empty($filters['settlement_type']) && $filters['settlement_type'] !== 'all') {
            $where[] = "s.settlement_type = ?";
            $params[] = $filters['settlement_type'];
        }

        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $where[] = "s.status = ?";
            $params[] = $filters['status'];
        }

        if (!empty($filters['partner_type']) && $filters['partner_type'] !== 'all') {
            $where[] = "s.partner_type = ?";
            $params[] = $filters['partner_type'];
        }

        if (!empty($filters['search'])) {
            $search = '%' . trim($filters['search']) . '%';
            $where[] = "(s.settlement_no LIKE ? OR p.name LIKE ? OR p.contact_no LIKE ? OR p.unique_id LIKE ? OR s.transaction_reference LIKE ?)";
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
        }

        $whereClause = implode(" AND ", $where);
        $limit = isset($filters['limit']) ? (int)$filters['limit'] : 100;
        $offset = isset($filters['offset']) ? (int)$filters['offset'] : 0;

        $sql = "
            SELECT 
                s.*,
                p.unique_id AS partner_unique_id,
                p.name AS partner_name,
                p.contact_no AS partner_contact,
                p.contact_no AS partner_phone,
                p.email_address AS partner_email,
                p.bank_details AS current_bank_details,
                v.shop_name AS vendor_shop_name,
                v.owner_name AS vendor_owner_name
            FROM delivery_partner_settlements s
            LEFT JOIN delivery_partners p ON s.partner_id = p.id
            LEFT JOIN admin_vendors v ON s.vendor_id = v.id
            WHERE {$whereClause}
            ORDER BY s.id DESC
            LIMIT {$offset}, {$limit}
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Record partner financial transaction in Partner_Ledger and atomically synchronize delivery_partners.wallet
     * Supported txn types: DELIVERY_EARNING, COD_COLLECTED, WITHDRAWAL, COD_DEPOSIT
     * Includes duplicate check to ensure idempotency.
     */
    public static function recordPartnerFinancialTransaction($pdo, $partnerId, $txnType, $amount, $orderId = null, $status = 'success') {
        $partnerId = (int)$partnerId;
        $amount = round((float)$amount, 2);
        if ($partnerId <= 0 || $amount <= 0) return false;

        $txnType = strtoupper(trim($txnType));

        // Idempotency check for DELIVERY_EARNING and COD_COLLECTED per order
        if ($orderId !== null && in_array($txnType, ['DELIVERY_EARNING', 'COD_COLLECTED'])) {
            $dupCheck = $pdo->prepare("SELECT id FROM Partner_Ledger WHERE partner_id = ? AND order_id = ? AND txn_type = ? AND tnx_status = 'success' LIMIT 1");
            $dupCheck->execute([$partnerId, (int)$orderId, $txnType]);
            if ($dupCheck->fetch()) {
                // Transaction already processed for this order
                return true;
            }
        }

        // 1. Lock and fetch partner details
        $stmt = $pdo->prepare("SELECT id, name, contact_no, wallet FROM delivery_partners WHERE id = ? FOR UPDATE");
        $stmt->execute([$partnerId]);
        $partner = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$partner) return false;

        // 2. Decode wallet JSON
        $wallet = !empty($partner['wallet']) ? json_decode($partner['wallet'], true) : [];
        if (!is_array($wallet)) $wallet = [];

        $totalEarnings = (float)($wallet['total_earnings'] ?? 0);
        $balance = (float)($wallet['balance'] ?? ($wallet['available_earnings'] ?? 0));
        $cashInHand = (float)($wallet['cash_in_hand'] ?? 0);
        $totalWithdrawals = (float)($wallet['total_withdrawals'] ?? 0);
        $totalDeposits = (float)($wallet['total_deposits'] ?? 0);
        $pendingWithdrawals = (float)($wallet['pending_withdrawals'] ?? 0);

        // 3. Apply balance updates based on transaction type
        switch ($txnType) {
            case 'DELIVERY_EARNING':
                $totalEarnings += $amount;
                $balance += $amount;
                break;

            case 'COD_COLLECTED':
                $cashInHand += $amount;
                break;

            case 'WITHDRAWAL':
                if ($amount > $balance && ($status === 'approved' || $status === 'success')) {
                    throw new Exception("Insufficient balance for withdrawal.");
                }
                if ($status === 'approved' || $status === 'success') {
                    $balance -= $amount;
                    $totalWithdrawals += $amount;
                }
                break;

            case 'COD_DEPOSIT':
                if ($amount > $cashInHand && ($status === 'approved' || $status === 'success')) {
                    throw new Exception("Deposit amount exceeds cash in hand.");
                }
                if ($status === 'approved' || $status === 'success') {
                    $cashInHand -= $amount;
                    $totalDeposits += $amount;
                }
                break;

            default:
                throw new Exception("Unsupported transaction type: $txnType");
        }

        unset($wallet['available_earnings']);
        $wallet['total_earnings'] = round((float)$totalEarnings, 2);
        $wallet['balance'] = round((float)$balance, 2);
        $wallet['cash_in_hand'] = round((float)$cashInHand, 2);
        $wallet['total_withdrawals'] = round((float)$totalWithdrawals, 2);
        $wallet['total_deposits'] = round((float)$totalDeposits, 2);
        $wallet['pending_withdrawals'] = round((float)$pendingWithdrawals, 2);
        $wallet['updated_at'] = date('Y-m-d H:i:s');

        // 4. Update delivery_partners.wallet
        @ini_set('serialize_precision', -1);
        $upStmt = $pdo->prepare("UPDATE delivery_partners SET wallet = ? WHERE id = ?");
        $upStmt->execute([json_encode($wallet, JSON_UNESCAPED_UNICODE), $partnerId]);

        // 5. Insert immutable record into Partner_Ledger
        $ledgerStmt = $pdo->prepare("
            INSERT INTO Partner_Ledger 
            (partner_id, order_id, txn_type, amount, tnx_status, created_at, partner_name, partner_phone) 
            VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)
        ");
        $ledgerStmt->execute([
            $partnerId, 
            $orderId ? (int)$orderId : null, 
            $txnType, 
            $amount, 
            $status, 
            $partner['name'] ?? null, 
            $partner['contact_no'] ?? null
        ]);

        return true;
    }
}
