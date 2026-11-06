import { mockStore } from './mockStore';

/**
 * Parses request body whether it's JSON string, FormData, or URLSearchParams
 */
const parseRequestBody = (body: any): any => {
  if (!body) return {};
  if (typeof body === 'object' && !(body instanceof FormData)) {
    return body;
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      // Maybe URL encoded
      const params = new URLSearchParams(body);
      const res: any = {};
      params.forEach((v, k) => { res[k] = v; });
      return res;
    }
  }
  return {};
};

export const handleMockApiRequest = async (url: string, options: any = {}): Promise<any> => {
  // Add a small realistic delay (150ms) to ensure spinners and UI micro-animations render naturally
  await new Promise(resolve => setTimeout(resolve, 150));

  const body = parseRequestBody(options.body);
  const normalizedUrl = url.toLowerCase();

  // 1. Send OTP
  if (normalizedUrl.includes('send_otp')) {
    const mobile = body.mobile_no || '9876543210';
    return {
      success: true,
      is_demo: true,
      demo_otp: '1234',
      message: `OTP sent to registered details for ${mobile}. Use 1234 in demo/mock mode.`,
    };
  }

  // 2. Verify OTP
  if (normalizedUrl.includes('verify_otp')) {
    const mobile = body.mobile_no || '';
    const otp = body.otp_code || '1234';
    const partner = mockStore.getPartner();
    if (mobile) partner.mobile_no = mobile;

    return {
      success: Boolean(otp),
      message: 'OTP verified successfully.',
      user: partner,
    };
  }

  // 3. Login (Password / Identifier)
  if (normalizedUrl.includes('auth/login')) {
    const partner = mockStore.getPartner();
    return {
      success: true,
      message: 'Login successful.',
      user: partner,
    };
  }

  // 4. Logout
  if (normalizedUrl.includes('auth/logout')) {
    return {
      success: true,
      message: 'Logged out successfully.',
    };
  }

  // 5. Profile
  if (normalizedUrl.includes('profile/profile') || normalizedUrl.includes('/profile.php')) {
    return {
      success: true,
      user: mockStore.getPartner(),
    };
  }

  // 6. Update Profile Photo
  if (normalizedUrl.includes('update_profile_photo')) {
    const newPhotoUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600&auto=format&fit=crop&q=80';
    mockStore.updatePartner({ profile_photo: newPhotoUrl });
    return {
      success: true,
      profile_photo: newPhotoUrl,
      message: 'Profile photo updated successfully.',
    };
  }

  // 7. Toggle Online/Offline Status
  if (normalizedUrl.includes('toggle') || normalizedUrl.includes('status/toggle')) {
    const isOnline = Number(body.is_online ?? 1);
    mockStore.toggleOnline(isOnline);
    return {
      success: true,
      is_online: isOnline,
      message: `Status updated to ${isOnline === 1 ? 'Online' : 'Offline'}.`,
    };
  }

  // 8. Home Stats
  if (normalizedUrl.includes('home_stats')) {
    return mockStore.getHomeStats();
  }

  // 9. Get Delivery Jobs
  if (normalizedUrl.includes('get_delivery_jobs') || normalizedUrl.includes('orders/')) {
    return {
      success: true,
      jobs: mockStore.getJobs(),
    };
  }

  // 10. Accept Delivery Job
  if (normalizedUrl.includes('accept_delivery_job')) {
    const jobId = body.job_id;
    const partnerId = body.partner_id || mockStore.getPartner().id;
    const success = mockStore.acceptJob(jobId, partnerId);
    return {
      success,
      message: success ? 'Order accepted successfully.' : 'Order not found.',
    };
  }

  // 11. Update Job Status (AT_STORE, PICKED_UP, OUT_FOR_DELIVERY, ARRIVED, DELIVERED)
  if (normalizedUrl.includes('update_job_status')) {
    const jobId = body.job_id;
    const status = body.status;
    const otp = body.otp_code;
    return mockStore.updateJobStatus(jobId, status, otp);
  }

  // 12. Update Item Picked
  if (normalizedUrl.includes('update_item_picked')) {
    const { job_id, item_id, is_picked } = body;
    const ok = mockStore.updateItemPicked(job_id, item_id, is_picked !== false);
    return {
      success: ok,
      message: ok ? 'Item state updated.' : 'Item not found.',
    };
  }

  // 13. Earnings & Ledger
  if (normalizedUrl.includes('earnings.php')) {
    const period = body.period || 'today';
    return mockStore.getEarnings(period);
  }

  // 14. Withdraw
  if (normalizedUrl.includes('withdraw.php')) {
    const amount = parseFloat(body.amount) || 0;
    return mockStore.withdraw(amount);
  }

  // 15. Deposit
  if (normalizedUrl.includes('deposit.php')) {
    const amount = parseFloat(body.amount) || 0;
    return mockStore.deposit(amount);
  }

  // 16. Get Account Settings (Bank & KYC)
  if (normalizedUrl.includes('get_account_settings')) {
    return mockStore.getAccountSettings();
  }

  // 17. Save Bank Details
  if (normalizedUrl.includes('save_bank_details')) {
    return mockStore.saveBankDetails(body);
  }

  // 18. Save KYC Document
  if (normalizedUrl.includes('save_kyc_document')) {
    return mockStore.saveKycDocument(body.doc_type);
  }

  // 19. Update FCM Token
  if (normalizedUrl.includes('update_fcm_token')) {
    if (body.fcm_token) {
      mockStore.updatePartner({ Fcm_Id: body.fcm_token });
    }
    return {
      success: true,
      message: 'FCM token synced successfully.',
    };
  }

  // 20. Update Location
  if (normalizedUrl.includes('location/update')) {
    if (body.lat && body.lng) {
      mockStore.updatePartner({ current_lat: String(body.lat), current_lng: String(body.lng) });
    }
    return {
      success: true,
      message: 'GPS location recorded.',
    };
  }

  // Fallback default response
  return {
    success: true,
    message: 'Mock response OK',
    data: {},
  };
};
