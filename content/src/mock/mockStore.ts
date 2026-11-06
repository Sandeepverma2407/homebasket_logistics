import { 
  INITIAL_MOCK_PARTNER, 
  INITIAL_MOCK_JOBS, 
  MOCK_BANK_DETAILS, 
  MOCK_KYC_DOCUMENTS, 
  MockPartner, 
  MockJob 
} from './mockData';

class MockStore {
  private partner: MockPartner = { ...INITIAL_MOCK_PARTNER };
  private jobs: MockJob[] = INITIAL_MOCK_JOBS.map(j => ({ ...j, items: j.items.map(it => ({ ...it })) }));
  private bankDetails = { ...MOCK_BANK_DETAILS };
  private kycDocuments = MOCK_KYC_DOCUMENTS.map(k => ({ ...k }));
  private activities: any[] = [
    { id: 'act-1', title: 'Order Delivered (#FD-4079)', date: 'Today, 04:30 PM', amount: '+₹55.00', status: 'COMPLETED' },
    { id: 'act-2', title: 'Order Delivered (#FD-4075)', date: 'Today, 01:15 PM', amount: '+₹58.00', status: 'COMPLETED' },
    { id: 'act-3', title: 'Withdrawal to Bank', date: 'Today, 10:15 AM', amount: '-₹500.00', status: 'PROCESSING' },
    { id: 'act-4', title: 'Order Delivered (#FD-4065)', date: 'Yesterday, 06:30 PM', amount: '+₹82.00', status: 'COMPLETED' },
    { id: 'act-5', title: 'Cash Deposit to Admin', date: 'Yesterday, 08:00 PM', amount: '-₹400.00', status: 'COMPLETED' },
  ];

  // ─── Partner Management ───────────────────────────────────────────────────
  public getPartner(): MockPartner {
    return { ...this.partner };
  }

  public updatePartner(updates: Partial<MockPartner>): MockPartner {
    this.partner = { ...this.partner, ...updates, updated_at: new Date().toISOString() };
    return { ...this.partner };
  }

  public toggleOnline(isOnline: number): boolean {
    this.partner.is_online = isOnline;
    return true;
  }

  // ─── Jobs Management ──────────────────────────────────────────────────────
  public getJobs(): MockJob[] {
    return this.jobs.map(j => ({ ...j, items: j.items.map(it => ({ ...it })) }));
  }

  public getJobById(jobId: number | string): MockJob | undefined {
    return this.jobs.find(
      j => String(j.id) === String(jobId) || 
           String(j.custom_order_id) === String(jobId) || 
           String(j.order_id) === String(jobId)
    );
  }

  public acceptJob(jobId: number | string, partnerId: number): boolean {
    const job = this.getJobById(jobId);
    if (!job) return false;
    job.partner_id = partnerId;
    job.status = 'ACCEPTED';
    return true;
  }

  public updateJobStatus(jobId: number | string, status: MockJob['status'], _otpCode?: string): { success: boolean; message: string } {
    const job = this.getJobById(jobId);
    if (!job) return { success: false, message: 'Order not found' };

    job.status = status;

    if (status === 'DELIVERED') {
      job.delivered_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const payout = parseFloat(job.payout_amount) || 0;
      const currentTotal = parseFloat(this.partner.total_earnings || '0');
      this.partner.total_earnings = (currentTotal + payout).toFixed(2);

      // If COD, add cash to partner's hand
      if (job.payment_method === 'COD') {
        const toPay = parseFloat(job.to_pay) || 0;
        const currentCash = parseFloat(this.partner.cash_in_hand || '0');
        this.partner.cash_in_hand = (currentCash + toPay).toFixed(2);
      }

      this.activities.unshift({
        id: `act-${Date.now()}`,
        title: `Order Delivered (#FD-${job.custom_order_id})`,
        date: 'Just now',
        amount: `+₹${payout.toFixed(2)}`,
        status: 'COMPLETED',
      });
    }

    return { success: true, message: `Status updated to ${status}` };
  }

  public updateItemPicked(jobId: number | string, itemId: number | string, isPicked: boolean): boolean {
    const job = this.getJobById(jobId);
    if (!job) return false;
    const item = job.items.find(it => String(it.item_id) === String(itemId));
    if (item) {
      item.is_picked = isPicked;
      return true;
    }
    return false;
  }

  // ─── Home Dashboard Stats ─────────────────────────────────────────────────
  public getHomeStats() {
    const all = this.getJobs();
    const todayStr = new Date().toISOString().split('T')[0];

    const completedJobs = all.filter(j => j.status === 'DELIVERED');
    const todayDeliveredJobs = completedJobs.filter(j => j.delivered_at && j.delivered_at.startsWith(todayStr));

    const todayEarningsVal = todayDeliveredJobs.reduce((sum, j) => sum + (parseFloat(j.payout_amount) || 0), 0);
    const todayDeliveriesCount = todayDeliveredJobs.length;

    const pendingJobs = all.filter(j => 
      j.partner_id === this.partner.id && 
      ['ACCEPTED', 'AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'].includes(j.status)
    );

    const requestQueue = all.filter(j => j.status === 'PENDING' && (j.partner_id === 0 || !j.partner_id));

    return {
      success: true,
      today_earnings: todayEarningsVal > 0 ? todayEarningsVal.toFixed(2) : '185.00',
      today_deliveries: todayDeliveriesCount > 0 ? todayDeliveriesCount : 2,
      completed_jobs: completedJobs,
      pending_jobs: pendingJobs,
      request_queue: requestQueue,
    };
  }

  // ─── Earnings Data ────────────────────────────────────────────────────────
  public getEarnings(period: string = 'today') {
    const isToday = period === 'today';
    const isWeekly = period === 'weekly';

    return {
      success: true,
      earnings: isToday ? '₹850.00' : isWeekly ? '₹5,820.00' : '₹24,500.00',
      today_earnings: this.partner.total_earnings,
      total_earnings: this.partner.total_earnings,
      cash_in_hand: this.partner.cash_in_hand,
      completed: isToday ? '4 Deliveries Completed' : isWeekly ? '28 Deliveries Completed' : '114 Deliveries Completed',
      online: isToday ? '₹450.00' : '₹3,420.00',
      cod: isToday ? '₹400.00' : '₹2,400.00',
      trend: '+12%',
      graphData: [
        { label: 'Mon', value: 58 },
        { label: 'Tue', value: 38 },
        { label: 'Wed', value: 82 },
        { label: 'Thu', value: 96, active: true },
        { label: 'Fri', value: 53 },
        { label: 'Sat', value: 67 },
        { label: 'Sun', value: 29 },
      ],
      incentiveCurrent: 60,
      incentiveTarget: 100,
      incentiveLabel: 'Complete 2 more orders today to earn extra ₹100.',
      bonusCurrent: 380,
      bonusTarget: 500,
      bonusLabel: 'On track! Keep going to unlock weekly ₹500 bonus.',
      basePay: isToday ? '₹620.00' : '₹4,100.00',
      surgePay: isToday ? '₹145.00' : '₹1,240.00',
      tips: isToday ? '₹85.00' : '₹480.00',
      totalBreakdown: isToday ? '₹850.00' : '₹5,820.00',
      recentActivity: [...this.activities],
    };
  }

  public withdraw(amount: number): { success: boolean; message: string } {
    const current = parseFloat(this.partner.total_earnings || '0');
    if (amount > current) {
      return { success: false, message: 'Withdrawal amount exceeds available wallet balance.' };
    }
    this.partner.total_earnings = (current - amount).toFixed(2);
    this.activities.unshift({
      id: `act-${Date.now()}`,
      title: 'Withdrawal to Bank',
      date: 'Just now',
      amount: `-₹${amount.toFixed(2)}`,
      status: 'PROCESSING',
    });
    return { success: true, message: `Withdrawal of ₹${amount.toFixed(2)} requested successfully.` };
  }

  public deposit(amount: number): { success: boolean; message: string } {
    const current = parseFloat(this.partner.cash_in_hand || '0');
    this.partner.cash_in_hand = Math.max(0, current - amount).toFixed(2);
    this.activities.unshift({
      id: `act-${Date.now()}`,
      title: 'Cash Handover / Deposit',
      date: 'Just now',
      amount: `-₹${amount.toFixed(2)}`,
      status: 'COMPLETED',
    });
    return { success: true, message: `Deposit of ₹${amount.toFixed(2)} recorded successfully.` };
  }

  // ─── Account Settings (Bank & KYC) ────────────────────────────────────────
  public getAccountSettings() {
    return {
      success: true,
      bank_details: { ...this.bankDetails },
      kyc_documents: this.kycDocuments.map(k => ({ ...k })),
    };
  }

  public saveBankDetails(details: any) {
    this.bankDetails = { ...this.bankDetails, ...details };
    return { success: true, message: 'Bank account details saved successfully.' };
  }

  public saveKycDocument(docType: string, fileUrl?: string) {
    const doc = this.kycDocuments.find(k => k.doc_type === docType);
    if (doc) {
      doc.status = 'approved';
      if (fileUrl) doc.front_file = fileUrl;
      doc.remarks = 'Document updated and verified.';
    }
    return { success: true, message: 'KYC document updated successfully.' };
  }
}

export const mockStore = new MockStore();
