<?php
@ini_set("display_errors", "0");
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_WARNING);

// Notification Target & Type Constants
if (!defined('NOTIF_TARGET_USER')) define('NOTIF_TARGET_USER', 'user');
if (!defined('NOTIF_TARGET_ADMIN')) define('NOTIF_TARGET_ADMIN', 'admin');

if (!defined('NOTIF_TYPE_USER_ORDER')) define('NOTIF_TYPE_USER_ORDER', 'order');
if (!defined('NOTIF_TYPE_SYSTEM')) define('NOTIF_TYPE_SYSTEM', 'system');

// Fetch Access Token using Service Account JWT
function getFCMAccessToken($serviceAccountJson) {
    $service_account = is_array($serviceAccountJson) ? $serviceAccountJson : json_decode($serviceAccountJson, true);
    if (!$service_account) {
        error_log("getFCMAccessToken: Invalid service account JSON: " . json_last_error_msg());
        return null;
    }

    $private_key = $service_account['private_key'] ?? '';
    $client_email = $service_account['client_email'] ?? '';
    
    if (empty($private_key) || empty($client_email)) {
        error_log("getFCMAccessToken: private_key or client_email is missing in service account");
        return null;
    }
    
    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $now = time();
    $payload = json_encode([
        'iss' => $client_email,
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now
    ]);
    
    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    
    $signature = '';
    if (!openssl_sign($base64UrlHeader . "." . $base64UrlPayload, $signature, $private_key, 'SHA256')) {
        error_log("getFCMAccessToken: openssl_sign failed: " . openssl_error_string());
        return null;
    }
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    $response = curl_exec($ch);
    $curlErr = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (PHP_VERSION_ID < 80000 && is_resource($ch)) { @curl_close($ch); }
    
    if ($curlErr) {
        error_log("getFCMAccessToken curl error: " . $curlErr);
    }
    
    $res_data = json_decode($response, true);
    if (!isset($res_data['access_token'])) {
        error_log("getFCMAccessToken failed (HTTP {$httpCode}): " . json_encode($res_data));
        return null;
    }
    return $res_data['access_token'];
}

// Send FCM notification using HTTP v1 API
function sendFCMNotification($pdo, $fcmToken, $title, $body, $dataPayload = [], $options = []) {
    try {
        $fcmToken = trim($fcmToken ?? '');
        if (empty($fcmToken)) {
            return ['success' => false, 'message' => 'FCM token is empty.'];
        }

        // Fetch Notification Settings
        $stmt = $pdo->prepare("SELECT setting_value FROM Settings WHERE setting_key = 'notification_settings' LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            // Fallback for lowercase table name in some environments
            $stmt = $pdo->prepare("SELECT setting_value FROM settings WHERE setting_key = 'notification_settings' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
        }
        
        if (!$row) {
            error_log("sendFCMNotification: notification_settings not found in database.");
            return ['success' => false, 'message' => 'Notification settings not found in database.'];
        }

        $config = json_decode($row['setting_value'], true);
        if (!$config) {
            error_log("sendFCMNotification: Failed to parse notification_settings JSON.");
            return ['success' => false, 'message' => 'Failed to parse notification_settings JSON.'];
        }

        $serviceAccountJson = $config['firebase_service_account_json'] ?? '';
        $saData = is_array($serviceAccountJson) ? $serviceAccountJson : json_decode($serviceAccountJson, true);

        // Clean & trim project ID, prefer project_id directly from service account json to prevent space/typo bugs
        $projectId = '';
        if (!empty($saData['project_id'])) {
            $projectId = trim($saData['project_id']);
        } elseif (!empty($config['firebase_project_id'])) {
            $projectId = trim($config['firebase_project_id']);
        }

        if (empty($projectId) || empty($serviceAccountJson)) {
            error_log("sendFCMNotification: Invalid notification configuration (missing projectId or serviceAccountJson).");
            return ['success' => false, 'message' => 'Invalid notification configuration.'];
        }

        $accessToken = getFCMAccessToken($serviceAccountJson);
        if (!$accessToken) {
            error_log("sendFCMNotification: Failed to retrieve FCM access token.");
            return ['success' => false, 'message' => 'Failed to retrieve FCM access token.'];
        }

        $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
        $headers = [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ];

        // Format data payload values to strings (FCM V1 requires all data values to be strings)
        $formattedData = [];
        foreach ($dataPayload as $key => $value) {
            $formattedData[strval($key)] = strval($value);
        }

        // Android Channel & Sound Options
        $channelId = $options['channel_id'] ?? 'order_channel_v5_alarm_ring';
        $sound = $options['sound'] ?? 'alarm_ring';

        $androidConfig = [
            'priority' => 'HIGH',
            'notification' => [
                'channel_id' => $channelId,
                'sound' => $sound,
                'default_sound' => false,
                'notification_priority' => 'PRIORITY_MAX',
                'default_vibrate_timings' => true,
                'visibility' => 'PUBLIC'
            ]
        ];

        $apnsConfig = [
            'payload' => [
                'aps' => [
                    'sound' => $sound . '.wav',
                    'content-available' => 1,
                    'badge' => 1
                ]
            ]
        ];

        $message = [
            'message' => [
                'token' => $fcmToken,
                'notification' => [
                    'title' => $title,
                    'body' => $body
                ],
                'data' => $formattedData,
                'android' => $androidConfig,
                'apns' => $apnsConfig
            ]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($message));
        
        $response = curl_exec($ch);
        $curlErr = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if (PHP_VERSION_ID < 80000 && is_resource($ch)) { @curl_close($ch); }

        $resDecoded = json_decode($response, true);
        if ($curlErr) {
            error_log("sendFCMNotification curl error: {$curlErr} | URL: {$url}");
        }

        if ($httpCode === 200) {
            return ['success' => true, 'response' => $resDecoded];
        } else {
            error_log("sendFCMNotification failed (HTTP {$httpCode}) for token " . substr($fcmToken, 0, 20) . "...: " . json_encode($resDecoded));
            return ['success' => false, 'message' => 'FCM returned status code ' . $httpCode, 'response' => $resDecoded];
        }
    } catch (Exception $e) {
        error_log("sendFCMNotification Exception: " . $e->getMessage());
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

// Router to send status notifications to store/vendor, user/customer, and admin
function sendOrderStatusNotification($pdo, $job_id, $partner_id, $status) {
    try {
        // 1. Fetch user, store, job & partner information
        $stmt = $pdo->prepare("
            SELECT 
                u.Fcm_id AS user_fcm, 
                u.name AS user_name, 
                o.order_id AS custom_order_id, 
                dp.name AS partner_name,
                COALESCE(v.FCM_TOKEN, c.Fcm_Id) AS store_fcm,
                o.restaurant_name AS store_name
            FROM delivery_job dj
            JOIN orders o ON dj.order_id = o.id
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN Delivery_Partners dp ON (dp.id = ? OR dp.id = dj.partner_id)
            LEFT JOIN Vendors v ON o.restaurant_id = v.Vendor_Id
            LEFT JOIN Credentials c ON c.User_Id = v.credential_id
            WHERE dj.id = ?
            LIMIT 1
        ");
        $stmt->execute([$partner_id, $job_id]);
        $info = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$info) {
            error_log("sendOrderStatusNotification: Job not found for job_id={$job_id}, partner_id={$partner_id}");
            return ['success' => false, 'message' => 'Job not found'];
        }

        $custom_order_id = "#FD-" . $info['custom_order_id'];
        $partner_name = !empty($info['partner_name']) ? $info['partner_name'] : 'Delivery Partner';
        $store_name = !empty($info['store_name']) ? $info['store_name'] : 'Restaurant';
        $user_fcm = trim($info['user_fcm'] ?? '');
        $store_fcm = trim($info['store_fcm'] ?? '');

        $results = ['store' => null, 'user' => null, 'admin' => []];

        // 2. STORE/VENDOR NOTIFICATIONS: Triggered on [ACCEPTED, AT_STORE, PICKED_UP]
        $store_statuses = ['ACCEPTED', 'AT_STORE', 'PICKED_UP'];
        if (in_array($status, $store_statuses) && !empty($store_fcm)) {
            $store_title = "";
            $store_body = "";

            switch ($status) {
                case 'ACCEPTED':
                    $store_title = "Delivery Partner Assigned 🛵";
                    $store_body = "Partner {$partner_name} accepted order {$custom_order_id} and is heading to your store.";
                    break;
                case 'AT_STORE':
                    $store_title = "Partner Arrived at Store 🏪";
                    $store_body = "Partner {$partner_name} has arrived at your store for order {$custom_order_id}.";
                    break;
                case 'PICKED_UP':
                    $store_title = "Order Picked Up 📦";
                    $store_body = "Partner {$partner_name} has picked up order {$custom_order_id} from your store.";
                    break;
            }

            if (!empty($store_title)) {
                // Use 'DELIVERY_STATUS_UPDATE' type so the store app shows a simple
                // notification toast — NOT the new-order alarm popup.
                // Use 'delivery_status_update' channel which has normal (non-alarm) sound.
                $results['store'] = sendFCMNotification($pdo, $store_fcm, $store_title, $store_body, [
                    'type'     => 'DELIVERY_STATUS_UPDATE',
                    'order_id' => $info['custom_order_id'],
                    'status'   => $status,
                    'target'   => 'store'
                ], [
                    'channel_id' => 'delivery_status_update',
                    'sound'      => 'default'
                ]);
            }
        }

        // 3. USER/CUSTOMER NOTIFICATIONS: Triggered on [ACCEPTED, PICKED_UP, OUT_FOR_DELIVERY, ARRIVED, DELIVERED, CANCELLED]
        $user_statuses = ['ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED', 'CANCELLED'];
        if (in_array($status, $user_statuses)) {
            if (empty($user_fcm)) {
                error_log("sendOrderStatusNotification: Cannot send to user for order {$custom_order_id} - User has no Fcm_id token in users table.");
            } else {
                $user_title = "";
                $user_body = "";

                switch ($status) {
                    case 'ACCEPTED':
                        $user_title = "Delivery Partner Assigned 🛵";
                        $user_body = "Delivery partner {$partner_name} has been assigned to your order {$custom_order_id} and is heading to the store.";
                        break;
                    case 'PICKED_UP':
                        $user_title = "Order Picked Up 🛍️";
                        $user_body = "Delivery partner {$partner_name} has picked up your order {$custom_order_id} from {$store_name}.";
                        break;
                    case 'OUT_FOR_DELIVERY':
                        $user_title = "Order Out for Delivery 🚚";
                        $user_body = "Your order {$custom_order_id} is out for delivery with {$partner_name}.";
                        break;
                    case 'ARRIVED':
                        $user_title = "Delivery Partner Arrived 📍";
                        $user_body = "Our delivery partner has arrived at your location for order {$custom_order_id}.";
                        break;
                    case 'DELIVERED':
                        $user_title = "Order Delivered 🎉";
                        $user_body = "Your order {$custom_order_id} has been delivered successfully. Thank you!";
                        break;
                    case 'CANCELLED':
                        $user_title = "Order Cancelled ❌";
                        $user_body = "Your order {$custom_order_id} has been cancelled.";
                        break;
                }

                if (!empty($user_title)) {
                    $results['user'] = sendFCMNotification($pdo, $user_fcm, $user_title, $user_body, [
                        'type' => 'order',
                        'order_id' => $info['custom_order_id'],
                        'status' => $status,
                        'target' => 'user'
                    ], [
                        'channel_id' => 'order_alerts',
                        'sound' => 'order_ring'
                    ]);
                }
            }
        }

        // 4. ADMIN NOTIFICATIONS: Triggered on EVERY status update by delivery partner
        $admin_title = "Order Status Update: {$status} 📦";
        $admin_body = "Order {$custom_order_id} status updated to {$status} by partner {$partner_name}.";

        // Fetch all admin FCM tokens
        $admin_stmt = $pdo->query("SELECT Fcm_Id FROM Credentials WHERE User_Type = '1' AND Fcm_Id IS NOT NULL AND Fcm_Id != ''");
        $admins = $admin_stmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($admins as $admin_fcm) {
            $admin_fcm = trim($admin_fcm);
            if (!empty($admin_fcm)) {
                $results['admin'][] = sendFCMNotification($pdo, $admin_fcm, $admin_title, $admin_body, [
                    'type' => 'system',
                    'order_id' => $info['custom_order_id'],
                    'status' => $status,
                    'target' => 'admin'
                ], [
                    'channel_id' => 'default',
                    'sound' => 'default'
                ]);
            }
        }

        return ['success' => true, 'details' => $results];
    } catch (Exception $e) {
        error_log("FCM Notification Error: " . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Sends High-Priority Alarm Push Notification to Delivery Partner(s) when a NEW ORDER is placed/assigned.
 * Plays loud alarm sound on the partner's device even if the app is closed or screen is off.
 *
 * @param PDO $pdo
 * @param int $job_id Delivery job ID
 * @param int|null $partner_id Specific partner ID, or null to broadcast to all active & online partners
 * @return array
 */
function sendNewOrderNotificationToDeliveryPartners($pdo, $job_id, $partner_id = null) {
    try {
        // Fetch Job and Order Details
        $stmt = $pdo->prepare("
            SELECT 
                dj.id AS job_id,
                dj.order_id AS db_order_id,
                dj.payout_amount,
                dj.estimated_distance,
                o.order_id AS custom_order_id,
                o.restaurant_name,
                o.restaurant_id,
                o.delivery_address,
                o.to_pay,
                o.payment_method,
                v.Full_Address AS restaurant_address,
                u.name AS user_name
            FROM delivery_job dj
            JOIN orders o ON dj.order_id = o.id
            LEFT JOIN Vendors v ON o.restaurant_id = v.Vendor_Id
            LEFT JOIN users u ON o.user_id = u.id
            WHERE dj.id = ?
            LIMIT 1
        ");
        $stmt->execute([$job_id]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            return ['success' => false, 'message' => 'Job not found'];
        }

        $custom_order_id = "#FD-" . $order['custom_order_id'];
        $title = "New Order Alert! 🚨 " . $custom_order_id;
        $body = "New order from {$order['restaurant_name']}. Tap to accept delivery!";

        $payload = [
            'type' => 'order',
            'target' => 'partner',
            'job_id' => (string)$order['job_id'],
            'order_id' => (string)$order['db_order_id'],
            'custom_order_id' => (string)$order['custom_order_id'],
            'restaurant_name' => (string)$order['restaurant_name'],
            'restaurant_address' => (string)($order['restaurant_address'] ?? ''),
            'delivery_address' => (string)($order['delivery_address'] ?? ''),
            'user_name' => (string)($order['user_name'] ?? 'Customer'),
            'payout_amount' => (string)$order['payout_amount'],
            'estimated_distance' => (string)$order['estimated_distance'],
            'status' => 'PENDING'
        ];

        // Sound mapping for each selectable alarm
        $soundMap = [
            'Classic Bell' => ['channel' => 'order_alerts_v5_classic_bell', 'sound' => 'classic_bell'],
            'Alarm Ring'   => ['channel' => 'order_alerts_v5_alarm_ring',   'sound' => 'alarm_ring'],
            'Mysterious'   => ['channel' => 'order_alerts_v5_mysterious',   'sound' => 'mysterious'],
            'Siren Alert'  => ['channel' => 'order_alerts_v5_siren_alert',  'sound' => 'siren_alert'],
            'Techno Alert' => ['channel' => 'order_alerts_v5_techno_alert', 'sound' => 'techno_alert'],
        ];

        $partnersList = [];
        if ($partner_id && (int)$partner_id > 0) {
            // Send to specified partner
            try {
                $p_stmt = $pdo->prepare("SELECT Fcm_Id, COALESCE(sound_preference, 'Classic Bell') AS sound_preference FROM Delivery_Partners WHERE id = ? AND trash = 0 AND Fcm_Id IS NOT NULL AND Fcm_Id != '' LIMIT 1");
                $p_stmt->execute([$partner_id]);
                $partnerRow = $p_stmt->fetch(PDO::FETCH_ASSOC);
                if ($partnerRow) $partnersList[] = $partnerRow;
            } catch (Throwable $pe) {
                $p_stmt = $pdo->prepare("SELECT Fcm_Id FROM Delivery_Partners WHERE id = ? AND trash = 0 AND Fcm_Id IS NOT NULL AND Fcm_Id != '' LIMIT 1");
                $p_stmt->execute([$partner_id]);
                $token = $p_stmt->fetchColumn();
                if ($token) $partnersList[] = ['Fcm_Id' => $token, 'sound_preference' => 'Classic Bell'];
            }
        } else {
            // Broadcast to all active & online delivery partners
            try {
                $p_stmt = $pdo->query("SELECT Fcm_Id, COALESCE(sound_preference, 'Classic Bell') AS sound_preference FROM Delivery_Partners WHERE is_online = 1 AND approve_status = 1 AND trash = 0 AND Fcm_Id IS NOT NULL AND Fcm_Id != ''");
                $partnersList = $p_stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Throwable $pe) {
                $p_stmt = $pdo->query("SELECT Fcm_Id FROM Delivery_Partners WHERE is_online = 1 AND approve_status = 1 AND trash = 0 AND Fcm_Id IS NOT NULL AND Fcm_Id != ''");
                $rawTokens = $p_stmt->fetchAll(PDO::FETCH_COLUMN);
                foreach ($rawTokens as $rt) {
                    $partnersList[] = ['Fcm_Id' => $rt, 'sound_preference' => 'Classic Bell'];
                }
            }
        }

        $results = [];
        foreach ($partnersList as $partnerItem) {
            $token = trim($partnerItem['Fcm_Id'] ?? '');
            $chosenSound = $partnerItem['sound_preference'] ?? 'Classic Bell';
            $soundConfig = $soundMap[$chosenSound] ?? ['channel' => 'order_channel_v5_alarm_ring', 'sound' => 'alarm_ring'];

            if (!empty($token)) {
                $results[] = sendFCMNotification($pdo, $token, $title, $body, $payload, [
                    'channel_id' => $soundConfig['channel'],
                    'sound' => $soundConfig['sound']
                ]);
            }
        }

        return ['success' => true, 'notified_count' => count($results), 'details' => $results];
    } catch (Exception $e) {
        error_log("sendNewOrderNotificationToDeliveryPartners Error: " . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

