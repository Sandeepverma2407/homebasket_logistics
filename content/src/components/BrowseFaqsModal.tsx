import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View, Text, Pressable, Animated, Dimensions, Platform, ScrollView, TextInput } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { APP_NAME } from '../constants/constant';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FAQItem {
  question: string;
  answer: string;
  category: 'General' | 'Deliveries' | 'Wallet' | 'Settlement';
}

const FAQS_DATA: FAQItem[] = [
  {
    category: 'Settlement',
    question: 'How fast are daily earnings settled to my bank account?',
    answer: 'All daily earnings are automatically calculated and processed via T+1 Settlement. Funds hit your registered bank account by 10:00 AM every morning.',
  },
  {
    category: 'Deliveries',
    question: 'What should I do if my location tracking goes offline?',
    answer: `Make sure background location permissions are set to "Always Allow" and battery optimization is disabled for ${APP_NAME} Partner app in your system settings.`,
  },
  {
    category: 'Wallet',
    question: 'How does commission rate calculation work?',
    answer: 'Your commission is calculated based on distance or fixed rate as configured in your contract, which you can see in the profile dashboard.',
  },
  {
    category: 'Deliveries',
    question: 'Can I cancel a delivery job after accepting it?',
    answer: 'Cancellations are discouraged as they affect service SLAs. If necessary due to emergency, immediately raise a ticket or call the support helpline.',
  },
  {
    category: 'Wallet',
    question: 'Where can I check my daily and weekly payouts?',
    answer: 'Go to your Earnings panel on the home dashboard or check the wallet transaction logs under the wallet settings tab.',
  },
  {
    category: 'General',
    question: 'Is internet required for completing deliveries?',
    answer: 'Yes, an active internet connection is required to update order statuses (ACCEPTED, AT_STORE, PICKED_UP, DELIVERED) and sync coordinates with the server.',
  },
];

interface BrowseFaqsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BrowseFaqsModal({ visible, onClose }: BrowseFaqsModalProps) {
  const { colors } = useTheme();
  const [shouldRender, setShouldRender] = useState(visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'General' | 'Deliveries' | 'Wallet' | 'Settlement'>('All');

  // Accordion expanded index
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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

  const toggleExpand = (index: number) => {
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else {
      setExpandedIndex(index);
    }
  };

  // Filter FAQs
  const filteredFaqs = FAQS_DATA.filter((faq) => {
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Frequently Asked Questions</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Search bar */}
          <View style={[styles.searchSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={[styles.searchBarContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 10, marginRight: 8 }}>
                <Circle cx="11" cy="11" r="8" stroke={colors.textSecondary} strokeWidth="2" />
                <Path d="M21 21l-4.35-4.35" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" />
              </Svg>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search questions (e.g. settlement, wallet, status...)"
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.textPrimary }]}
              />
            </View>
          </View>

          {/* Filter Categories scroll bar */}
          <View style={[styles.categoriesScrollContainer, { borderBottomColor: colors.border }]}>
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContent}>
              {([
                { key: 'All', label: 'All' },
                { key: 'General', label: 'General' },
                { key: 'Deliveries', label: 'Deliveries & Status' },
                { key: 'Wallet', label: 'Wallet & Earning' },
                { key: 'Settlement', label: 'Settlement & Payouts' }
              ] as const).map((tab) => {
                const isSelected = selectedCategory === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      setSelectedCategory(tab.key);
                      setExpandedIndex(null);
                    }}
                    style={[
                      styles.categoryTab,
                      isSelected ? { backgroundColor: '#00C896' } : { backgroundColor: colors.card, borderColor: colors.border }
                    ]}
                  >
                    <Text style={[styles.categoryTabText, isSelected ? { color: '#ffffff' } : { color: colors.textSecondary }]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* FAQs List */}
          <ScrollView contentContainerStyle={styles.faqsContent} showsVerticalScrollIndicator={false}>
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, index) => {
                const isExpanded = expandedIndex === index;
                const categoryLabel =
                  faq.category === 'Settlement' ? 'SETTLEMENT & PAYOUTS' :
                    faq.category === 'Deliveries' ? 'DELIVERIES & GPS' :
                      faq.category === 'Wallet' ? 'WALLET & COMMISSION' : 'GENERAL';

                return (
                  <View key={index} style={[styles.faqItemContainer, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={() => toggleExpand(index)} style={styles.faqHeader}>
                      <View style={styles.faqHeaderLeft}>
                        <Text style={[styles.faqCategoryLabel, { color: '#00C896' }]}>{categoryLabel}</Text>
                        <Text style={[styles.faqQuestionText, { color: colors.textPrimary }]}>{faq.question}</Text>
                      </View>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
                        <Path
                          d="M6 9l6 6 6-6"
                          stroke={colors.textSecondary}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </Pressable>

                    {isExpanded && (
                      <View style={[styles.faqAnswerContainer, { backgroundColor: colors.iconBg }]}>
                        <Text style={[styles.faqAnswerText, { color: colors.textSecondary }]}>
                          {faq.answer}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No matching questions found.</Text>
              </View>
            )}

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
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 32,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchBarContainer: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    paddingRight: 12,
  },
  categoriesScrollContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryTabText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  faqsContent: {
    paddingHorizontal: 20,
  },
  faqItemContainer: {
    borderBottomWidth: 1,
    paddingVertical: 16,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  faqHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  faqCategoryLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  faqQuestionText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    lineHeight: 20,
  },
  faqAnswerContainer: {
    marginTop: 12,
    borderRadius: 8,
    padding: 12,
  },
  faqAnswerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
});
