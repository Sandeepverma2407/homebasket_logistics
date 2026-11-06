import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View, Text, Pressable, Animated, Dimensions, Platform, ScrollView, TextInput, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { APP_NAME } from '../constants/constant';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HelpSupportModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HelpSupportModal({ visible, onClose }: HelpSupportModalProps) {
  const { colors } = useTheme();
  const [shouldRender, setShouldRender] = useState(visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Form states
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'Order' | 'Settlement' | 'Wallet' | 'App'>('Order');
  const [urgency, setUrgency] = useState<'Low' | 'Normal' | 'Urgent'>('Normal');
  const [description, setDescription] = useState('');

  // Animation controller
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
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

  const handleCall = () => {
    Linking.openURL('tel:18001234567').catch(() => {
      alert('Unable to open dialer. Support Helpline: 1800-123-4567');
    });
  };

  const handleWhatsApp = () => {
    Linking.openURL(`whatsapp://send?phone=+919898989898&text=Hello, I need help with my ${APP_NAME} delivery account.`).catch(() => {
      Linking.openURL('https://wa.me/919898989898').catch(() => {
        alert('WhatsApp is not installed. Support WhatsApp number: +91 9898989898');
      });
    });
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@homebasket.com?subject=Delivery Partner Support').catch(() => {
      alert('Unable to open mail client. Support email: support@homebasket.com');
    });
  };

  const handleSubmitTicket = () => {
    if (!subject.trim() || !description.trim()) {
      alert('Please fill out all required fields.');
      return;
    }
    alert(`Ticket raised successfully!\n\nSubject: ${subject}\nCategory: ${category}\nUrgency: ${urgency}`);
    setSubject('');
    setDescription('');
    onClose();
  };

  if (!shouldRender) return null;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.background,
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable onPress={onClose} hitSlop={15} style={styles.backButton}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6l12 12"
                  stroke={colors.textPrimary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Help & Support</Text>
              <Text style={styles.liveIndicator}>● 24/7 Live Delivery Support</Text>
            </View>
            <View style={styles.placeholder} />
          </View>

          {/* Scrollable Content */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Section 1: Instant Support Channels */}
            <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>Instant Support Channels</Text>
            <View style={styles.channelsContainer}>
              {/* Call Card */}
              <Pressable onPress={handleCall} style={[styles.channelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.channelIconCircle, { backgroundColor: '#EAFDF7' }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                      stroke="#00C896"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.channelCardTitle, { color: colors.textPrimary }]}>Call Helpline</Text>
                <Text style={styles.channelCardSub}>Toll Free 1800</Text>
              </Pressable>

              {/* WhatsApp Card */}
              <Pressable onPress={handleWhatsApp} style={[styles.channelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.channelIconCircle, { backgroundColor: '#EAFDF7' }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                      stroke="#00C896"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.channelCardTitle, { color: colors.textPrimary }]}>WhatsApp</Text>
                <Text style={styles.channelCardSub}>Instant Chat</Text>
              </Pressable>

              {/* Email Card */}
              <Pressable onPress={handleEmail} style={[styles.channelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.channelIconCircle, { backgroundColor: '#EAFDF7' }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                      stroke="#00C896"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path d="M22 6l-10 7L2 6" stroke="#00C896" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={[styles.channelCardTitle, { color: colors.textPrimary }]}>Email Us</Text>
                <Text style={styles.channelCardSub}>Official Response</Text>
              </Pressable>
            </View>

            {/* Section 2: Raise a Priority Ticket */}
            <View style={[styles.ticketFormContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.formHeaderRow}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                    stroke="#00C896"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[styles.formHeaderTitle, { color: colors.textPrimary }]}>Raise a Priority Ticket</Text>
              </View>

              {/* Subject */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Subject *</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Brief summary of your issue..."
                placeholderTextColor={colors.textMuted}
                style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]}
              />

              {/* Category Chips */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Issue Category *</Text>
              <View style={styles.chipsContainer}>
                {(['Order', 'Settlement', 'Wallet', 'App'] as const).map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.chipButton,
                        isSelected ? { backgroundColor: '#00C896' } : { backgroundColor: colors.background, borderColor: colors.border }
                      ]}
                    >
                      <Text style={[styles.chipText, isSelected ? { color: '#ffffff' } : { color: colors.textSecondary }]}>
                        {cat === 'Order' ? 'Order Issue' : cat === 'Settlement' ? 'Settlement & Payout' : cat === 'Wallet' ? 'Wallet & Card' : 'App Technical'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Urgency */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Urgency Level *</Text>
              <View style={styles.chipsContainer}>
                {(['Low', 'Normal', 'Urgent'] as const).map((urg) => {
                  const isSelected = urgency === urg;
                  return (
                    <Pressable
                      key={urg}
                      onPress={() => setUrgency(urg)}
                      style={[
                        styles.chipButton,
                        { flex: 1, alignItems: 'center' },
                        isSelected ? { backgroundColor: '#00C896' } : { backgroundColor: colors.background, borderColor: colors.border }
                      ]}
                    >
                      <Text style={[styles.chipText, isSelected ? { color: '#ffffff' } : { color: colors.textSecondary }]}>
                        {urg}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Description */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Description *</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe what happened, order numbers, or app errors..."
                placeholderTextColor={colors.textMuted}
                multiline={true}
                numberOfLines={4}
                style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]}
              />

              {/* Submit Button */}
              <Pressable onPress={handleSubmitTicket} style={styles.submitButton}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                  <Path
                    d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.submitButtonText}>Submit Support Ticket</Text>
              </Pressable>
            </View>

            {/* Section 3: Recent Tickets */}
            <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>Recent Tickets</Text>

            {/* Ticket Card 1 */}
            <View style={[styles.recentTicketCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.ticketRow}>
                <Text style={[styles.ticketIdText, { color: colors.textPrimary }]}>#TK-9821 • Settlement Delayed</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#EAFDF7' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#00C896' }]}>Resolved</Text>
                </View>
              </View>
              <Text style={[styles.ticketDateText, { color: colors.textSecondary }]}>Opened 2 days ago</Text>
            </View>

            {/* Ticket Card 2 */}
            <View style={[styles.recentTicketCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.ticketRow}>
                <Text style={[styles.ticketIdText, { color: colors.textPrimary }]}>#TK-9840 • App Crash on Swipe</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#FFF9E6' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#FFA800' }]}>In Progress</Text>
                </View>
              </View>
              <Text style={[styles.ticketDateText, { color: colors.textSecondary }]}>Opened Today, 11:30 AM</Text>
            </View>

            {/* Bottom spacing helper */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </View>
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
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
  },
  liveIndicator: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: '#00C896',
    marginTop: 2,
  },
  placeholder: {
    width: 32,
  },
  scrollContent: {
    padding: 20,
  },
  sectionHeader: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  channelsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  channelCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  channelIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  channelCardTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    textAlign: 'center',
  },
  channelCardSub: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    color: '#8A94A6',
    marginTop: 2,
    textAlign: 'center',
  },
  ticketFormContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
    paddingBottom: 12,
  },
  formHeaderTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
  },
  inputLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#00C896',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    fontFamily: 'Inter-Bold',
    color: '#ffffff',
    fontSize: 14,
  },
  recentTicketCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 4,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketIdText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
  },
  ticketDateText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
});
