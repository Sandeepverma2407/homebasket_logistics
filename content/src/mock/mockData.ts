/**
 * Realistic Mock Data for Delivery Partner App
 * Used when USE_MOCK_DATA is enabled in config.ts
 */

export interface MockPartner {
  id: number;
  DP_ID: string;
  name: string;
  mobile_no: string;
  email: string;
  partner_type?: string;
  vehicle_type: string;
  vehicle_number: string;
  city: string;
  address: string;
  profile_photo: string | null;
  approve_status: 'pending' | 'approved' | 'rejected';
  status: 'active' | 'blocked';
  is_online: number;
  last_login: string;
  current_lat: string;
  current_lng: string;
  working_status: 'AVAILABLE' | 'ON_DELIVERY';
  commission_type: 'fixed' | 'distance';
  commission_rate: string;
  min_commission_amount: string;
  total_earnings: string;
  cash_in_hand: string;
  Fcm_Id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockOrderItem {
  item_id: number;
  name: string;
  quantity: number;
  price: string;
  is_picked: boolean;
}

export interface MockJob {
  id: number;
  db_id?: number;
  custom_order_id: string;
  order_id?: number;
  partner_id: number;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_city: string;
  restaurant_latitude: number;
  restaurant_longitude: number;
  delivery_address: string;
  user_name: string;
  user_phone: string;
  user_latitude: number;
  user_longitude: number;
  estimated_distance: string;
  commission_rate: string;
  min_commission_amount: string;
  payout_amount: string;
  payment_method: 'COD' | 'ONLINE';
  to_pay: string;
  delivery_instructions: string;
  status: 'PENDING' | 'ACCEPTED' | 'AT_STORE' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'ARRIVED' | 'DELIVERED' | 'CANCELLED';
  created_at: string;
  delivered_at: string | null;
  items: MockOrderItem[];
}

export const INITIAL_MOCK_PARTNER: MockPartner = {
  id: 101,
  DP_ID: 'DP-7890',
  name: 'Rohan Sharma',
  mobile_no: '9876543210',
  email: 'rohan.delivery@mtbexpress.com',
  partner_type: 'Central',
  vehicle_type: 'Motorcycle',
  vehicle_number: 'KA 05 MN 4821',
  city: 'Bangalore',
  address: 'HSR Layout, Sector 2, 27th Main, Bangalore - 560102',
  profile_photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600&auto=format&fit=crop&q=80',
  approve_status: 'approved',
  status: 'active',
  is_online: 1,
  last_login: new Date().toISOString().replace('T', ' ').substring(0, 19),
  current_lat: '12.9121',
  current_lng: '77.6446',
  working_status: 'AVAILABLE',
  commission_type: 'distance',
  commission_rate: '15.00',
  min_commission_amount: '35.00',
  total_earnings: '14850.00',
  cash_in_hand: '450.00',
  Fcm_Id: 'mock-fcm-token-12345',
  created_at: '2026-01-10 10:00:00',
  updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
};

// Formats timestamp relative to now
const getPastDateString = (hoursAgo: number): string => {
  const d = new Date(Date.now() - hoursAgo * 3600 * 1000);
  return d.toISOString().replace('T', ' ').substring(0, 19);
};

export const INITIAL_MOCK_JOBS: MockJob[] = [
  // 1. Unassigned new request (Pending in queue)
  {
    id: 9901,
    db_id: 9901,
    custom_order_id: '5021',
    order_id: 5021,
    partner_id: 0,
    restaurant_name: "Nature's Basket Organic Mart",
    restaurant_address: 'Ground Floor, 14th Main, HSR Layout Sector 4',
    restaurant_city: 'Bangalore',
    restaurant_latitude: 12.9110,
    restaurant_longitude: 77.6430,
    delivery_address: 'Flat 402, Sunshine Residency, 19th Main, Sector 1, HSR Layout, Bangalore - 560102. Contact: +91 98450 12345',
    user_name: 'Ananya Verma',
    user_phone: '+91 98450 12345',
    user_latitude: 12.9180,
    user_longitude: 77.6520,
    estimated_distance: '3.2',
    commission_rate: '15.00',
    min_commission_amount: '35.00',
    payout_amount: '65.00',
    payment_method: 'ONLINE',
    to_pay: '420.00',
    delivery_instructions: 'Leave package with security gate if not answering.',
    status: 'PENDING',
    created_at: getPastDateString(0.1),
    delivered_at: null,
    items: [
      { item_id: 1, name: 'Organic Cold Pressed Mustard Oil 1L', quantity: 1, price: '210.00', is_picked: false },
      { item_id: 2, name: 'Country Eggs Box (Pack of 12)', quantity: 1, price: '110.00', is_picked: false },
      { item_id: 3, name: 'Organic Brown Bread 400g', quantity: 2, price: '50.00', is_picked: false },
    ],
  },
  // 2. Active assigned order in progress
  {
    id: 9902,
    db_id: 9902,
    custom_order_id: '4081',
    order_id: 4081,
    partner_id: 101,
    restaurant_name: 'Green Grocers & Daily Needs',
    restaurant_address: 'Shop #8, Commercial Complex, Sector 3, HSR Layout',
    restaurant_city: 'Bangalore',
    restaurant_latitude: 12.9135,
    restaurant_longitude: 77.6390,
    delivery_address: 'Villa 14, Palm Meadows, 24th Main, Sector 2, HSR Layout, Bangalore - 560102. Phone: +91 98765 43210',
    user_name: 'Priya Sharma',
    user_phone: '+91 98765 43210',
    user_latitude: 12.9195,
    user_longitude: 77.6475,
    estimated_distance: '2.5',
    commission_rate: '15.00',
    min_commission_amount: '35.00',
    payout_amount: '72.00',
    payment_method: 'COD',
    to_pay: '380.00',
    delivery_instructions: 'Ring doorbell twice. Cash will be handed over at door.',
    status: 'ACCEPTED',
    created_at: getPastDateString(0.5),
    delivered_at: null,
    items: [
      { item_id: 11, name: 'Fresh Farm Tomatoes 1kg', quantity: 2, price: '45.00', is_picked: true },
      { item_id: 12, name: 'Shimla Apple Royal Delicious 1kg', quantity: 1, price: '180.00', is_picked: true },
      { item_id: 13, name: 'Amul Butter 500g', quantity: 1, price: '275.00', is_picked: false },
    ],
  },
  // 3. Delivered order earlier today
  {
    id: 9903,
    db_id: 9903,
    custom_order_id: '4079',
    order_id: 4079,
    partner_id: 101,
    restaurant_name: 'Apollo Pharmacy & Wellness',
    restaurant_address: 'Main Road, 5th Sector, HSR Layout',
    restaurant_city: 'Bangalore',
    restaurant_latitude: 12.9125,
    restaurant_longitude: 77.6410,
    delivery_address: 'Flat 104, Blue Star Apts, Sector 6, HSR Layout, Bangalore. Phone: +91 97412 34567',
    user_name: 'Karthik Rao',
    user_phone: '+91 97412 34567',
    user_latitude: 12.9160,
    user_longitude: 77.6490,
    estimated_distance: '1.8',
    commission_rate: '15.00',
    min_commission_amount: '35.00',
    payout_amount: '55.00',
    payment_method: 'ONLINE',
    to_pay: '290.00',
    delivery_instructions: 'Hand over to recipient directly.',
    status: 'DELIVERED',
    created_at: getPastDateString(3),
    delivered_at: getPastDateString(2.2),
    items: [
      { item_id: 21, name: 'Dettol Antiseptic Liquid 250ml', quantity: 1, price: '140.00', is_picked: true },
      { item_id: 22, name: 'Crocin Pain Relief Pack of 15', quantity: 2, price: '75.00', is_picked: true },
    ],
  },
  // 4. Delivered order earlier today
  {
    id: 9904,
    db_id: 9904,
    custom_order_id: '4075',
    order_id: 4075,
    partner_id: 101,
    restaurant_name: 'Milton Fresh Bakery & Cafe',
    restaurant_address: '17th Cross, Sector 7, HSR Layout',
    restaurant_city: 'Bangalore',
    restaurant_latitude: 12.9090,
    restaurant_longitude: 77.6460,
    delivery_address: 'House #45, 9th Main, Sector 1, HSR Layout, Bangalore. Phone: +91 99001 88223',
    user_name: 'Deepak Nair',
    user_phone: '+91 99001 88223',
    user_latitude: 12.9150,
    user_longitude: 77.6530,
    estimated_distance: '2.1',
    commission_rate: '15.00',
    min_commission_amount: '35.00',
    payout_amount: '58.00',
    payment_method: 'COD',
    to_pay: '310.00',
    delivery_instructions: 'Please call before arriving.',
    status: 'DELIVERED',
    created_at: getPastDateString(6),
    delivered_at: getPastDateString(5.2),
    items: [
      { item_id: 31, name: 'Sourdough Artisan Loaf', quantity: 1, price: '160.00', is_picked: true },
      { item_id: 32, name: 'Blueberry Cheesecake Slice', quantity: 2, price: '150.00', is_picked: true },
    ],
  },
  // 5. Delivered order yesterday
  {
    id: 9905,
    db_id: 9905,
    custom_order_id: '4065',
    order_id: 4065,
    partner_id: 101,
    restaurant_name: 'Fresh Fruits Hub',
    restaurant_address: 'Sector 2, HSR Layout',
    restaurant_city: 'Bangalore',
    restaurant_latitude: 12.9140,
    restaurant_longitude: 77.6420,
    delivery_address: 'Apartment 201, Green View, Bellandur, Bangalore. Phone: +91 98860 11223',
    user_name: 'Sneha Patel',
    user_phone: '+91 98860 11223',
    user_latitude: 12.9220,
    user_longitude: 77.6580,
    estimated_distance: '4.1',
    commission_rate: '15.00',
    min_commission_amount: '35.00',
    payout_amount: '82.00',
    payment_method: 'ONLINE',
    to_pay: '540.00',
    delivery_instructions: 'Leave at front door.',
    status: 'DELIVERED',
    created_at: getPastDateString(26),
    delivered_at: getPastDateString(25.1),
    items: [
      { item_id: 41, name: 'Imported Kiwi Box (3 pcs)', quantity: 2, price: '130.00', is_picked: true },
      { item_id: 42, name: 'Dragon Fruit Pink 1pc', quantity: 2, price: '140.00', is_picked: true },
    ],
  },
  // 6. Delivered order earlier this week
  {
    id: 9906,
    db_id: 9906,
    custom_order_id: '4038',
    order_id: 4038,
    partner_id: 101,
    restaurant_name: 'Metro Mega Supermarket',
    restaurant_address: 'Outer Ring Road, Marathahalli',
    restaurant_city: 'Bangalore',
    restaurant_latitude: 12.9300,
    restaurant_longitude: 77.6700,
    delivery_address: 'Tower B, Sobha Iris, Bellandur, Bangalore. Phone: +91 98700 99887',
    user_name: 'Vikram Mehta',
    user_phone: '+91 98700 99887',
    user_latitude: 12.9250,
    user_longitude: 77.6650,
    estimated_distance: '3.6',
    commission_rate: '15.00',
    min_commission_amount: '35.00',
    payout_amount: '75.00',
    payment_method: 'ONLINE',
    to_pay: '680.00',
    delivery_instructions: 'Contactless delivery preferred.',
    status: 'DELIVERED',
    created_at: getPastDateString(72),
    delivered_at: getPastDateString(71.2),
    items: [
      { item_id: 51, name: 'Tata Tea Gold 1kg', quantity: 1, price: '450.00', is_picked: true },
      { item_id: 52, name: 'Britannia Good Day Biscuits Box', quantity: 2, price: '115.00', is_picked: true },
    ],
  },
];

export const MOCK_BANK_DETAILS = {
  bank_name: 'State Bank of India',
  account_number: '304918273645',
  account_holder: 'Rohan Sharma',
  account_type: 'saving',
  ifsc_code: 'SBIN0001234',
  branch_name: 'HSR Layout 5th Sector, Bangalore',
  bank_document_type: 'cheque',
  bank_document: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
};

export const MOCK_KYC_DOCUMENTS = [
  {
    doc_type: 'aadhaar',
    status: 'approved',
    front_file: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80',
    back_file: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80',
    remarks: 'Aadhaar verified via DigiLocker',
  },
  {
    doc_type: 'pan',
    status: 'approved',
    front_file: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80',
    back_file: null,
    remarks: 'PAN verified successfully',
  },
  {
    doc_type: 'driving_license',
    status: 'approved',
    front_file: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80',
    back_file: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80',
    remarks: 'Valid Two-Wheeler MCWG License',
  },
  {
    doc_type: 'rc_book',
    status: 'approved',
    front_file: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80',
    back_file: null,
    remarks: 'Vehicle RC book verified',
  },
];
