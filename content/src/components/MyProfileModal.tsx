import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import CONFIG from '../connection/config';
import { resolveImageUrl } from '../constants/constant';
import { compressImage } from '../constants/imageCompressor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const uriToBlob = (uri: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function (e) {
      console.warn("uriToBlob error:", e);
      reject(new Error('uriToBlob failed'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
};

const formatAccountNumber = (num: string): string => {
  if (!num) return '•••• •••• •••• ••••';
  const clean = num.replace(/\s?/g, '');
  const chunks = [];
  for (let i = 0; i < clean.length; i += 4) {
    chunks.push(clean.slice(i, i + 4));
  }
  return chunks.join('  ');
};

interface MyProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'bank' | 'kyc';
type KycDocType = 'aadhar' | 'pan' | 'vehicle' | 'driving_licence';

interface KycDocState {
  docNo: string;
  localUri: string | null;
  onlineUrl: string;
  status: 'pending' | 'approved' | 'rejected' | 'none';
}

export default function MyProfileModal({ visible, onClose }: MyProfileModalProps) {
  const { colors } = useTheme();
  const { partner } = useAuth();
  const [shouldRender, setShouldRender] = useState(visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabType>('bank');

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [savingKycDoc, setSavingKycDoc] = useState<KycDocType | null>(null);

  // Bank Form States
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountType, setAccountType] = useState<'saving' | 'current'>('saving');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [bankDocType, setBankDocType] = useState<'cheque' | 'passbook' | 'statement'>('cheque');
  const [bankDocUri, setBankDocUri] = useState<string | null>(null);
  const [bankDocOnlineUrl, setBankDocOnlineUrl] = useState('');
  const [isEditingBank, setIsEditingBank] = useState(true);

  // KYC Form States
  const [kycDocs, setKycDocs] = useState<Record<KycDocType, KycDocState>>({
    aadhar: { docNo: '', localUri: null, onlineUrl: '', status: 'none' },
    pan: { docNo: '', localUri: null, onlineUrl: '', status: 'none' },
    vehicle: { docNo: '', localUri: null, onlineUrl: '', status: 'none' },
    driving_licence: { docNo: '', localUri: null, onlineUrl: '', status: 'none' },
  });

  // Keep track of which KYC document slot is expanded
  const [expandedKyc, setExpandedKyc] = useState<KycDocType | null>(null);

  // Upload Progress States
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listenerId = progressAnim.addListener(({ value }) => {
      setUploadProgress(Math.round(value * 100));
    });
    return () => {
      progressAnim.removeListener(listenerId);
    };
  }, []);

  const startProgress = () => {
    setUploadProgress(0);
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 0.9,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  };

  const finishProgress = () => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      setTimeout(() => {
        setUploadProgress(0);
        progressAnim.setValue(0);
      }, 400);
    });
  };

  // Toast State
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast({ visible: true, message, type });
    
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      });
    }, 3000);
  };

  const renderUploadProgress = (label: string) => {
    const widthInterpolate = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <View style={[styles.progressContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressText, { color: colors.textPrimary }]}>{label}</Text>
          <Text style={[styles.progressPercent, { color: colors.accent }]}>{uploadProgress}%</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.background }]}>
          <Animated.View style={[styles.progressBar, { width: widthInterpolate, backgroundColor: colors.accent }]} />
        </View>
      </View>
    );
  };

  // Animation controller
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      fetchSettings();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible]);

  // Fetch bank and KYC settings
  const fetchSettings = async () => {
    if (!partner?.id) return;
    setIsLoading(true);
    try {
      const response = await fetch(CONFIG.ENDPOINTS.GET_ACCOUNT_SETTINGS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_id: partner.id }),
      });
      const res = await response.json();
      if (res.success) {
        if (res.bank_details) {
          setBankName(res.bank_details.bank_name || '');
          setAccountNumber(res.bank_details.account_number || '');
          setAccountHolder(res.bank_details.account_holder || '');
          setAccountType(res.bank_details.account_type || 'saving');
          setIfscCode(res.bank_details.ifsc_code || '');
          setBranchName(res.bank_details.branch_name || '');
          setBankDocType(res.bank_details.bank_document_type || 'cheque');
          setBankDocOnlineUrl(res.bank_details.bank_document || '');
          setIsEditingBank(false);
        } else {
          // Clear form if no details exist
          setBankName('');
          setAccountNumber('');
          setAccountHolder('');
          setAccountType('saving');
          setIfscCode('');
          setBranchName('');
          setBankDocType('cheque');
          setBankDocUri(null);
          setBankDocOnlineUrl('');
          setIsEditingBank(true);
        }

        const freshKyc: Record<KycDocType, KycDocState> = {
          aadhar: { docNo: '', localUri: null, onlineUrl: '', status: 'none' },
          pan: { docNo: '', localUri: null, onlineUrl: '', status: 'none' },
          vehicle: { docNo: '', localUri: null, onlineUrl: '', status: 'none' },
          driving_licence: { docNo: '', localUri: null, onlineUrl: '', status: 'none' },
        };

        if (res.kyc_documents && Array.isArray(res.kyc_documents)) {
          res.kyc_documents.forEach((doc: any) => {
            const type = doc.document_type as KycDocType;
            if (freshKyc[type]) {
              freshKyc[type] = {
                docNo: doc.document_no || '',
                localUri: null,
                onlineUrl: doc.document_path || '',
                status: doc.is_approved || 'pending',
              };
            }
          });
        }
        setKycDocs(freshKyc);
      }
    } catch (e) {
      console.warn('Error fetching account settings:', e);
      showToast('Unable to fetch profile details. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Image Picking
  const pickDocument = async (target: 'bank' | KycDocType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('We need photo library permissions to upload documents!', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedUri = result.assets[0].uri;
      const compressedUri = await compressImage(selectedUri);
      if (target === 'bank') {
        setBankDocUri(compressedUri);
      } else {
        setKycDocs((prev) => ({
          ...prev,
          [target]: {
            ...prev[target],
            localUri: compressedUri,
          },
        }));
      }
    }
  };

  // Save Bank Details
  const handleSaveBank = async () => {
    if (!partner?.id) return;
    if (!bankName || !accountNumber || !accountHolder || !ifscCode) {
      showToast('Please fill in all required bank fields.', 'error');
      return;
    }

    setIsSavingBank(true);
    startProgress();
    try {
      const formData = new FormData();
      formData.append('partner_id', partner.id.toString());
      formData.append('bank_name', bankName);
      formData.append('account_number', accountNumber);
      formData.append('account_holder', accountHolder);
      formData.append('account_type', accountType);
      formData.append('ifsc_code', ifscCode);
      formData.append('branch_name', branchName);
      formData.append('bank_document_type', bankDocType);

      if (bankDocUri) {
        const uriParts = bankDocUri.split('/');
        const fileName = uriParts[uriParts.length - 1];
        const blob = await uriToBlob(bankDocUri);
        formData.append('bank_document', blob, fileName);
      }

      const response = await fetch(CONFIG.ENDPOINTS.SAVE_BANK_DETAILS, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      });

      const res = await response.json();
      if (res.success) {
        finishProgress();
        await new Promise((resolve) => setTimeout(resolve, 300));
        showToast('Bank details saved successfully.', 'success');
        setBankDocUri(null);
        if (res.bank_document) {
          setBankDocOnlineUrl(res.bank_document);
        }
        setIsEditingBank(false);
      } else {
        showToast(res.message || 'Failed to save bank details.', 'error');
      }
    } catch (e) {
      console.warn('Error saving bank details:', e);
      showToast('An error occurred while saving bank details.', 'error');
    } finally {
      setIsSavingBank(false);
    }
  };

  // Save KYC Document
  const handleSaveKyc = async (type: KycDocType) => {
    if (!partner?.id) return;
    const doc = kycDocs[type];

    if (!doc.docNo.trim()) {
      showToast('Please enter the document identification number.', 'error');
      return;
    }

    if (!doc.localUri && !doc.onlineUrl) {
      showToast('Please upload a photo of the document.', 'error');
      return;
    }

    const docNoClean = doc.docNo.trim().toUpperCase();
    if (type === 'aadhar') {
      if (!/^\d{12}$/.test(docNoClean)) {
        showToast('Aadhaar Card number must be exactly 12 digits.', 'error');
        return;
      }
    } else if (type === 'pan') {
      if (!/^[A-Z0-9]{10}$/.test(docNoClean)) {
        showToast('PAN Card number must be exactly 10 characters (numbers and capital letters).', 'error');
        return;
      }
    } else if (type === 'vehicle') {
      if (!/^[A-Z0-9]{6,15}$/.test(docNoClean)) {
        showToast('Vehicle registration number must be alphanumeric (6 to 15 uppercase characters).', 'error');
        return;
      }
    } else if (type === 'driving_licence') {
      if (!/^[A-Z0-9]{8,20}$/.test(docNoClean)) {
        showToast('Driving License number must be alphanumeric (8 to 20 uppercase characters).', 'error');
        return;
      }
    }

    setSavingKycDoc(type);
    startProgress();
    try {
      const formData = new FormData();
      formData.append('partner_id', partner.id.toString());
      formData.append('document_type', type);
      formData.append('document_no', doc.docNo);

      if (doc.localUri) {
        const uriParts = doc.localUri.split('/');
        const fileName = uriParts[uriParts.length - 1];
        const blob = await uriToBlob(doc.localUri);
        formData.append('kyc_document', blob, fileName);
      }

      const response = await fetch(CONFIG.ENDPOINTS.SAVE_KYC_DOCUMENT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      });

      const res = await response.json();
      if (res.success) {
        finishProgress();
        await new Promise((resolve) => setTimeout(resolve, 300));
        showToast(`${getKycDocLabel(type)} saved and submitted for review.`, 'success');
        setKycDocs((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            localUri: null,
            onlineUrl: res.document_path || prev[type].onlineUrl,
            status: 'pending',
          },
        }));
        setExpandedKyc(null);
      } else {
        showToast(res.message || 'Failed to save document.', 'error');
      }
    } catch (e) {
      console.warn('Error saving KYC document:', e);
      showToast('An error occurred while saving the document.', 'error');
    } finally {
      setSavingKycDoc(null);
    }
  };

  const getKycDocLabel = (type: KycDocType) => {
    switch (type) {
      case 'aadhar':
        return 'Aadhaar Card';
      case 'pan':
        return 'PAN Card';
      case 'vehicle':
        return 'Vehicle Registration (RC)';
      case 'driving_licence':
        return 'Driving License';
    }
  };

  const renderStatusBadge = (status: KycDocState['status']) => {
    let text = 'Not Uploaded';
    let bgColor = colors.inputBg;
    let textColor = colors.textSecondary;

    if (status === 'approved') {
      text = 'Approved';
      bgColor = '#EAFDF7';
      textColor = '#00C896';
    } else if (status === 'rejected') {
      text = 'Rejected';
      bgColor = '#FDF2F2';
      textColor = '#FF4D4D';
    } else if (status === 'pending') {
      text = 'Pending Review';
      bgColor = '#FEF9EC';
      textColor = '#FFAA00';
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.statusBadgeText, { color: textColor }]}>{text}</Text>
      </View>
    );
  };

  if (!shouldRender) return null;

  return (
    <Modal visible={true} transparent={true} animationType="none" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.background,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable onPress={onClose} hitSlop={15} style={styles.backButton}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 19l-7-7 7-7"
                  stroke={colors.accent}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Profile</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Navigation Tabs */}
          <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable
              onPress={() => setActiveTab('bank')}
              style={[
                styles.tabItem,
                activeTab === 'bank' && [styles.activeTabItem, { borderBottomColor: colors.accent }],
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'bank' ? colors.accent : colors.textSecondary },
                  activeTab === 'bank' && styles.tabTextBold,
                ]}
              >
                Bank Details
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('kyc')}
              style={[
                styles.tabItem,
                activeTab === 'kyc' && [styles.activeTabItem, { borderBottomColor: colors.accent }],
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'kyc' ? colors.accent : colors.textSecondary },
                  activeTab === 'kyc' && styles.tabTextBold,
                ]}
              >
                KYC Documents
              </Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading details...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {activeTab === 'bank' ? (
                /* ─── TAB 1: BANK DETAILS ─── */
                !isEditingBank ? (
                  /* Premium ATM Card View */
                  <View style={styles.atmCardWrapper}>
                    <View style={styles.atmCard}>
                      {/* Holographic Glowing Blobs */}
                      <View style={styles.glowBlob1} />
                      <View style={styles.glowBlob2} />
                      
                      {/* Diagonal Glass Sheen */}
                      <View style={styles.glassSheen} />
                      
                      {/* Card Content Overlay */}
                      <View style={styles.atmCardContent}>
                        {/* Top Row: Brand & Bank Name */}
                        <View style={styles.atmCardTop}>
                          <View style={styles.brandContainer}>
                            <Svg width={36} height={22} viewBox="0 0 36 22" fill="none">
                              <Circle cx="11" cy="11" r="11" fill="rgba(255, 255, 255, 0.15)" />
                              <Circle cx="25" cy="11" r="11" fill="rgba(0, 200, 150, 0.45)" />
                              <Circle cx="18" cy="11" r="6" fill="rgba(255, 255, 255, 0.25)" />
                            </Svg>
                          </View>
                          
                          <Text style={styles.atmBankName} numberOfLines={1}>{bankName.toUpperCase()}</Text>
                        </View>

                        {/* Middle Row: Gold Chip & Contactless Waves + Account Type */}
                        <View style={styles.chipRow}>
                          <View style={styles.atmChip}>
                            <Svg width={38} height={28} viewBox="0 0 38 28" fill="none">
                              <Path d="M4 0h30a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z" fill="url(#chipGrad)" />
                              <Path d="M0 7h12v14H0M38 7H26v14h12M12 14h14M19 0v28" stroke="rgba(0, 0, 0, 0.35)" strokeWidth="1.2" />
                              <Circle cx="19" cy="14" r="5" fill="none" stroke="rgba(0, 0, 0, 0.35)" strokeWidth="1.2" />
                              <Path d="M6 7v14M32 7v14" stroke="rgba(0, 0, 0, 0.2)" strokeWidth="1" />
                              <Defs>
                                <LinearGradient id="chipGrad" x1="0" y1="0" x2="38" y2="28" gradientUnits="userSpaceOnUse">
                                  <Stop offset="0" stopColor="#FFE893" />
                                  <Stop offset="0.5" stopColor="#E2B743" />
                                  <Stop offset="1" stopColor="#9C7714" />
                                </LinearGradient>
                              </Defs>
                            </Svg>
                          </View>
                          
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {/* Account Type Label */}
                            <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                              <Text style={{ fontFamily: 'Inter-Bold', fontSize: 8, color: '#ffffff', letterSpacing: 0.5 }}>
                                {accountType.toUpperCase()} A/C
                              </Text>
                            </View>

                            {/* Contactless waves signal */}
                            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                              <Path d="M4.5 12a7.5 7.5 0 0 1 0-4.24M7.5 12a4.5 4.5 0 0 1 0-2.83M10.5 12a1.5 1.5 0 0 1 0-1.42M1.5 12A10.5 10.5 0 0 1 1.5 6.36" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                            </Svg>
                          </View>
                        </View>

                        {/* Account Number in spaced out card font */}
                        <Text style={styles.atmCardNumber}>{formatAccountNumber(accountNumber)}</Text>

                        {/* Bottom Row: Holder Name & IFSC */}
                        <View style={styles.atmCardBottom}>
                          <View style={styles.atmCardBottomLeft}>
                            <Text style={styles.atmLabel}>CARDHOLDER</Text>
                            <Text style={styles.atmValue} numberOfLines={1}>{accountHolder.toUpperCase()}</Text>
                          </View>

                          <View style={styles.atmCardBottomRight}>
                            <Text style={styles.atmLabel}>IFSC CODE</Text>
                            <Text style={styles.atmValue} numberOfLines={1}>{ifscCode.toUpperCase()}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Additional info and actions below card */}
                    <View style={[styles.bankSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Branch:</Text>
                        <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{branchName || 'Not Specified'}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Document:</Text>
                        <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                          {bankDocType.toUpperCase()} {bankDocOnlineUrl ? '✓ (Uploaded)' : '(No document)'}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => setIsEditingBank(true)}
                      style={[styles.editBankButton, { borderColor: colors.accent }]}
                    >
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"
                          stroke={colors.accent}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                      <Text style={[styles.editBankButtonText, { color: colors.accent }]}>Edit Bank Details</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.formContainer}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PAYOUT BANK ACCOUNT</Text>

                    {/* Account Holder Name */}
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        Account Holder Name <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="Enter account holder name"
                        placeholderTextColor={colors.textMuted}
                        value={accountHolder}
                        onChangeText={setAccountHolder}
                      />
                    </View>

                    {/* Bank Name */}
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        Bank Name <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. State Bank of India"
                        placeholderTextColor={colors.textMuted}
                        value={bankName}
                        onChangeText={setBankName}
                      />
                    </View>

                    {/* Account Number */}
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        Account Number <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="Enter bank account number"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        value={accountNumber}
                        onChangeText={setAccountNumber}
                      />
                    </View>

                    {/* IFSC Code */}
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        IFSC Code <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. SBIN0001234"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="characters"
                        value={ifscCode}
                        onChangeText={setIfscCode}
                      />
                    </View>

                    {/* Branch Name */}
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Branch Name</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="Enter branch name"
                        placeholderTextColor={colors.textMuted}
                        value={branchName}
                        onChangeText={setBranchName}
                      />
                    </View>

                    {/* Account Type (Saving / Current) */}
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Account Type</Text>
                      <View style={styles.segmentedContainer}>
                        <Pressable
                          onPress={() => setAccountType('saving')}
                          style={[
                            styles.segmentButton,
                            { borderColor: colors.border },
                            accountType === 'saving' && [styles.segmentActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
                          ]}
                        >
                          <Text style={[styles.segmentText, { color: accountType === 'saving' ? '#ffffff' : colors.textPrimary }]}>Saving</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setAccountType('current')}
                          style={[
                            styles.segmentButton,
                            { borderColor: colors.border },
                            accountType === 'current' && [styles.segmentActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
                          ]}
                        >
                          <Text style={[styles.segmentText, { color: accountType === 'current' ? '#ffffff' : colors.textPrimary }]}>Current</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />

                    {/* Supporting Document Type */}
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Supporting Document Type</Text>
                      <View style={styles.segmentedContainer}>
                        {(['cheque', 'passbook', 'statement'] as const).map((type) => (
                          <Pressable
                            key={type}
                            onPress={() => setBankDocType(type)}
                            style={[
                              styles.segmentButton,
                              { borderColor: colors.border },
                              bankDocType === type && [styles.segmentActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
                            ]}
                          >
                            <Text
                              style={[
                                styles.segmentText,
                                { fontSize: 11, color: bankDocType === type ? '#ffffff' : colors.textPrimary },
                              ]}
                            >
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    {/* Upload supporting document file */}
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Upload Document Image</Text>
                      <Pressable
                        onPress={() => pickDocument('bank')}
                        style={[styles.filePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
                            stroke={colors.accent}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                        <Text style={[styles.filePickerButtonText, { color: colors.accent }]}>
                          {bankDocUri || bankDocOnlineUrl ? 'Replace Selected Image' : 'Select From Gallery'}
                        </Text>
                      </Pressable>

                      {/* Previews */}
                      {bankDocUri ? (
                        <View style={[styles.previewContainer, { borderColor: colors.border }]}>
                          <Image source={{ uri: bankDocUri }} style={styles.previewImage} />
                          <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>New File Selected</Text>
                        </View>
                      ) : bankDocOnlineUrl ? (
                        <View style={[styles.previewContainer, { borderColor: colors.border }]}>
                          <Image source={{ uri: resolveImageUrl(bankDocOnlineUrl) }} style={styles.previewImage} />
                          <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Existing Document Online</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Save button or progress bar */}
                    {isSavingBank ? (
                      renderUploadProgress('Uploading bank details...')
                    ) : (
                      <Pressable
                        onPress={handleSaveBank}
                        style={[styles.saveButton, { backgroundColor: colors.accent }]}
                      >
                        <Text style={styles.saveButtonText}>Save Bank Details</Text>
                      </Pressable>
                    )}
                  </View>
                )
              ) : (
                /* ─── TAB 2: KYC DOCUMENTS ─── */
                <View style={styles.formContainer}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>REQUIRED KYC VERIFICATION</Text>

                  {(['aadhar', 'pan', 'vehicle', 'driving_licence'] as const).map((type) => {
                    const doc = kycDocs[type];
                    const isExpanded = expandedKyc === type;
                    const isSaving = savingKycDoc === type;

                    return (
                      <View
                        key={type}
                        style={[
                          styles.kycDocCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: isExpanded ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        {/* Summary Header */}
                        <Pressable
                          onPress={() => setExpandedKyc(isExpanded ? null : type)}
                          style={styles.kycCardHeader}
                        >
                          <View style={styles.kycHeaderLeft}>
                            <View style={[styles.docIconWrapper, { backgroundColor: colors.iconBg }]}>
                              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                <Path
                                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                                  stroke={colors.accent}
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <Path
                                  d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
                                  stroke={colors.accent}
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </Svg>
                            </View>
                            <View>
                              <Text style={[styles.kycDocTitle, { color: colors.textPrimary }]}>{getKycDocLabel(type)}</Text>
                              {doc.docNo ? (
                                <Text style={[styles.kycDocSub, { color: colors.textSecondary }]}>ID: {doc.docNo}</Text>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.kycHeaderRight}>
                            {renderStatusBadge(doc.status)}
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={isExpanded && styles.arrowRotated}>
                              <Path
                                d="M6 9l6 6 6-6"
                                stroke={colors.textSecondary}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </Svg>
                          </View>
                        </Pressable>

                        {/* Expanded details form */}
                        {isExpanded && (
                          <View style={[styles.kycCardBody, { borderTopColor: colors.border }]}>
                            {/* Document number */}
                            <View style={styles.inputGroup}>
                              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                Document ID Number <Text style={styles.requiredStar}>*</Text>
                              </Text>
                              <TextInput
                                style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                                placeholder={`Enter ${getKycDocLabel(type)} Number`}
                                placeholderTextColor={colors.textMuted}
                                value={doc.docNo}
                                autoCapitalize={type === 'aadhar' ? 'none' : 'characters'}
                                keyboardType={type === 'aadhar' ? 'numeric' : 'default'}
                                onChangeText={(val) => {
                                  let formatted = val;
                                  if (type === 'aadhar') {
                                    formatted = val.replace(/[^0-9]/g, '').slice(0, 12);
                                  } else if (type === 'pan') {
                                    formatted = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                                  } else {
                                    formatted = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
                                  }
                                  setKycDocs((prev) => ({
                                    ...prev,
                                    [type]: { ...prev[type], docNo: formatted },
                                  }));
                                }}
                              />
                            </View>

                            {/* File Upload picker */}
                            <View style={styles.inputGroup}>
                              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Upload Document Image</Text>
                              <Pressable
                                onPress={() => pickDocument(type)}
                                style={[styles.filePickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                              >
                                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                  <Path
                                    d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
                                    stroke={colors.accent}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </Svg>
                                <Text style={[styles.filePickerButtonText, { color: colors.accent }]}>
                                  {doc.localUri || doc.onlineUrl ? 'Replace Selected Image' : 'Select From Gallery'}
                                </Text>
                              </Pressable>

                              {/* Previews */}
                              {doc.localUri ? (
                                <View style={[styles.previewContainer, { borderColor: colors.border }]}>
                                  <Image source={{ uri: doc.localUri }} style={styles.previewImage} />
                                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>New File Selected</Text>
                                </View>
                              ) : doc.onlineUrl ? (
                                <View style={[styles.previewContainer, { borderColor: colors.border }]}>
                                  <Image source={{ uri: resolveImageUrl(doc.onlineUrl) }} style={styles.previewImage} />
                                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Existing Document Online</Text>
                                </View>
                              ) : null}
                            </View>

                            {/* Submit this document button or progress bar */}
                            {isSaving ? (
                              renderUploadProgress('Uploading KYC document...')
                            ) : (
                              <Pressable
                                onPress={() => handleSaveKyc(type)}
                                style={[styles.saveKycButton, { backgroundColor: colors.accent }]}
                              >
                                <Text style={styles.saveKycButtonText}>Upload & Submit</Text>
                              </Pressable>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </View>

      {toast.visible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
              backgroundColor: toast.type === 'success' ? '#10B981' : '#EF4444',
            },
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalCard: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        paddingTop: 16,
      },
    }),
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 32,
  },
  tabBar: {
    flexDirection: 'row',
    height: 48,
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  tabTextBold: {
    fontFamily: 'Inter-Bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  formContainer: {
    gap: 20,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  requiredStar: {
    color: '#FF4D4D',
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: 'Inter-Medium',
    fontSize: 15,
  },
  segmentedContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    borderWidth: 1,
  },
  segmentText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  dividerLine: {
    height: 1,
    marginVertical: 4,
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  filePickerButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    gap: 6,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    resizeMode: 'contain',
  },
  previewLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    fontFamily: 'Inter-Bold',
    color: '#ffffff',
    fontSize: 15,
  },
  kycDocCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  kycCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    height: 72,
  },
  kycHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  docIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycDocTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  kycDocSub: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    marginTop: 2,
  },
  kycHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
  },
  arrowRotated: {
    transform: [{ rotate: '180deg' }],
  },
  kycCardBody: {
    borderTopWidth: 1,
    padding: 16,
    gap: 16,
  },
  saveKycButton: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveKycButtonText: {
    fontFamily: 'Inter-Bold',
    color: '#ffffff',
    fontSize: 14,
  },
  atmCardWrapper: {
    gap: 16,
  },
  atmCard: {
    height: 206,
    borderRadius: 24,
    padding: 22,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0B0F19',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  glowBlob1: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0, 200, 150, 0.18)',
  },
  glowBlob2: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0, 108, 73, 0.12)',
  },
  glassSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    transform: [{ rotate: '-25deg' }, { scale: 1.8 }],
  },
  atmCardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  atmCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: {
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  atmChip: {
    width: 38,
    height: 28,
    borderRadius: 5,
    overflow: 'hidden',
  },
  atmBankName: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  atmCardNumber: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2.5,
    marginVertical: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 1.5,
  },
  atmCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  atmCardBottomLeft: {
    flex: 1,
    marginRight: 10,
  },
  atmCardBottomRight: {
    alignItems: 'flex-end',
  },
  atmLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  atmValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  bankSummaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  summaryValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  editBankButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
    marginTop: 8,
  },
  editBankButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  progressContainer: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  progressPercent: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
    zIndex: 9999,
  },
  toastText: {
    color: '#ffffff',
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    textAlign: 'center',
  },
});
