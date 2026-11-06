import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Dimensions,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY, USE_LIVE_TRACKING_MAP } from '../constants/constant';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Line, G, Text as SvgText } from 'react-native-svg';
import CustomButton from '@/components/CustomButton';
import CustomInput from '@/components/CustomInput';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import CONFIG from '../connection/config';
import SwipeButton from '../components/SwipeButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type DeliveryStage = 'in_transit' | 'arrived';

const CANCEL_REASONS = [
  'Customer not available',
  'Wrong address / unable to find',
  'Customer refused delivery',
  'Order damaged in transit',
  'Safety concern at location',
  'Other',
];

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { partner } = useAuth();
  const webViewRef = React.useRef<WebView>(null);

  const orderId = params.orderId || '#FD-8921';
  const restaurantLatParam = parseFloat(params.restaurantLat as string);
  const restaurantLngParam = parseFloat(params.restaurantLng as string);
  const userLatParam = parseFloat(params.userLat as string);
  const userLngParam = parseFloat(params.userLng as string);

  const [jobDetails, setJobDetails] = useState<any>(null);

  const storeLat = !isNaN(restaurantLatParam) ? restaurantLatParam : (jobDetails?.restaurant_latitude ? parseFloat(jobDetails.restaurant_latitude) : 28.6139);
  const storeLng = !isNaN(restaurantLngParam) ? restaurantLngParam : (jobDetails?.restaurant_longitude ? parseFloat(jobDetails.restaurant_longitude) : 77.2090);

  const deliveryLat = !isNaN(userLatParam) ? userLatParam : (jobDetails?.user_latitude ? parseFloat(jobDetails.user_latitude) : 28.6250);
  const deliveryLng = !isNaN(userLngParam) ? userLngParam : (jobDetails?.user_longitude ? parseFloat(jobDetails.user_longitude) : 77.2150);

  const customerLat = deliveryLat;
  const customerLng = deliveryLng;

  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(2)} km away`;
  };

  const openNavigationAlert = (lat: number, lng: number, label: string) => {
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const appleMapsUrl = `maps://0,0?q=${lat},${lng}`;

    const buttons: any[] = [
      {
        text: 'Google Maps',
        onPress: () => Linking.openURL(googleMapsUrl),
      },
    ];

    if (Platform.OS === 'ios') {
      buttons.push({
        text: 'Apple Maps',
        onPress: () => Linking.openURL(appleMapsUrl),
      });
    }

    buttons.push({
      text: 'Cancel',
      style: 'cancel',
    });

    Alert.alert(
      'Navigate to Customer',
      `Choose a map application to navigate to ${label}:`,
      buttons,
      { cancelable: true }
    );
  };

  const [stage, setStage] = useState<DeliveryStage>('in_transit');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [cancelNotes, setCancelNotes] = useState('');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [partnerCoords, setPartnerCoords] = useState<{ latitude: number, longitude: number } | null>(null);

  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchJobDetails = async () => {
      if (!params.jobId || !partner?.id) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(CONFIG.ENDPOINTS.GET_DELIVERY_JOBS, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({ partner_id: partner.id })
        });
        const data = await response.json();
        console.log('[MapScreen] Fetch jobs response success:', data.success);
        if (data.success && data.jobs) {
          const targetJob = data.jobs.find((j: any) => 
            (params.jobId && String(j.id) === String(params.jobId)) ||
            (params.orderId && String(j.custom_order_id) === String(params.orderId)) ||
            (params.orderId && String(j.order_id) === String(params.orderId))
          );
          if (targetJob) {
            console.log('[MapScreen] Found job details:', targetJob.id, 'restaurant:', targetJob.restaurant_name);
            setJobDetails(targetJob);
          }
        }
      } catch (error) {
        console.error('[MapScreen] Error fetching job details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchJobDetails();
  }, [params.jobId, partner?.id]);

  React.useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      try {
        const initialLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setPartnerCoords({
          latitude: initialLoc.coords.latitude,
          longitude: initialLoc.coords.longitude,
        });
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'UPDATE_LOCATION',
          lat: initialLoc.coords.latitude,
          lng: initialLoc.coords.longitude,
        }));
      } catch (e) {
        console.log('[MapScreen] Error fetching initial location:', e);
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          setPartnerCoords({ latitude, longitude });
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'UPDATE_LOCATION',
            lat: latitude,
            lng: longitude,
          }));
        }
      );
    })();

    return () => {
      locationSubscription?.remove();
    };
  }, []);

  // Theme-specific map colors
  const landColor = isDarkMode ? '#111613' : '#f0fdf4';
  const parkColor = isDarkMode ? '#1a2620' : '#d1fae5';
  const waterColor = isDarkMode ? '#1e293b' : '#d0e8ff';
  const roadColor = isDarkMode ? '#222926' : '#ffffff';
  const roadOutlineColor = isDarkMode ? '#333e38' : '#e2e8f0';

  const handleArrivedAtCustomer = async () => {
    if (params.jobId && partner?.id) {
      try {
        const response = await fetch(CONFIG.ENDPOINTS.UPDATE_JOB_STATUS, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({
            partner_id: partner.id,
            job_id: parseInt(params.jobId as string, 10),
            status: 'ARRIVED'
          })
        });
        const data = await response.json();
        if (!data.success) {
          Alert.alert('Error', data.message || 'Failed to update status.');
        }
      } catch (error) {
        console.error('Error updating status to ARRIVED:', error);
      }
    }
    setStage('arrived');
  };

  const handleComplete = () => {
    router.push({
      pathname: '/complete',
      params: { orderId, jobId: params.jobId }
    });
  };

  const handleCancelSubmit = async () => {
    if (params.jobId && partner?.id) {
      try {
        const response = await fetch(CONFIG.ENDPOINTS.UPDATE_JOB_STATUS, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({
            partner_id: partner.id,
            job_id: parseInt(params.jobId as string, 10),
            status: 'CANCELLED'
          })
        });
        const data = await response.json();
        if (!data.success) {
          Alert.alert('Error', data.message || 'Failed to cancel order.');
          return;
        }
      } catch (error) {
        console.error('Error updating status to CANCELLED:', error);
        Alert.alert('Error', 'Connection failed. Please try again.');
        return;
      }
    }
    setShowCancelModal(false);
    router.replace('/home');
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const cleanDeliveryAddress = (jobDetails?.delivery_address || 'Block B, Apartment 302, Green Valley')
    .replace(/(?:Contact|Phone|Mobile|Tel)[:\s-]*\+?\d[\d\s-]{8,14}\d/gi, '')
    .trim()
    .replace(/,\s*$/, '');

  // Helper to split address into line1 (house/landmark) and line2 (other details)
  const getSplitAddress = (address: string) => {
    const parts = address.split(/[\r\n,]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return { line1: '', line2: '' };
    if (parts.length === 1) return { line1: parts[0], line2: '' };
    if (parts.length === 2) return { line1: parts[0], line2: parts[1] };
    if (parts.length === 3) return { line1: parts[0] + ', ' + parts[1], line2: parts[2] };

    const landmarkKeywords = ['near', 'opposite', 'behind', 'beside', 'next to', 'landmark', 'opp', 'front of'];
    let landmarkIndex = -1;
    for (let i = 0; i < parts.length; i++) {
      const partLower = parts[i].toLowerCase();
      if (landmarkKeywords.some(kw => partLower.includes(kw))) {
        landmarkIndex = i;
        break;
      }
    }

    if (landmarkIndex !== -1) {
      const line1 = parts.slice(0, landmarkIndex + 1).join(', ');
      const line2 = parts.slice(landmarkIndex + 1).join(', ');
      return { line1, line2 };
    } else {
      const line1 = parts.slice(0, 2).join(', ');
      const line2 = parts.slice(2).join(', ');
      return { line1, line2 };
    }
  };

  const shortDeliveryAddress = (() => {
    const parts = cleanDeliveryAddress.split(',');
    if (parts.length > 1) {
      return `${parts[0].trim()}, ${parts[1].trim()}`;
    }
    return cleanDeliveryAddress;
  })();

  const customOrderId = jobDetails?.custom_order_id || orderId;
  const storeName = jobDetails?.restaurant_name || 'Fresh Supermarket';

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.iconBg }]}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 12H5M12 19l-7-7 7-7"
              stroke={colors.textPrimary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Delivery Route</Text>
        <Pressable 
          onPress={() => openNavigationAlert(customerLat, customerLng, 'Customer Location')} 
          style={[styles.backButton, { backgroundColor: colors.iconBg }]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 2L2 22l10-4 10 4L12 2z"
              stroke={colors.textPrimary}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={colors.accentLight}
            />
          </Svg>
        </Pressable>
      </View>

      {/* Google Maps WebView */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <style>
                  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e5e7eb; }
                  .gm-style-cc { display: none !important; }
                  a[href^="http://maps.google.com/maps"], a[href^="https://maps.google.com/maps"], a[href^="https://www.google.com/maps"] {
                    display: none !important;
                  }
                  .gmnoprint a, .gmnoprint span, .gm-style-cc { display: none !important; }
                </style>
              </head>
              <body>
                <div id="map"></div>
                <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}"></script>
                <script>
                  var storeLat = ${storeLat};
                  var storeLng = ${storeLng};
                  var deliveryLat = ${deliveryLat};
                  var deliveryLng = ${deliveryLng};
                  var isLiveTracking = ${USE_LIVE_TRACKING_MAP ? 'true' : 'false'};

                  var map, storeMarker, userMarker, riderMarker, routeLine;

                  function initMap() {
                    var storePos = { lat: storeLat, lng: storeLng };
                    var deliveryPos = { lat: deliveryLat, lng: deliveryLng };

                    map = new google.maps.Map(document.getElementById('map'), {
                      zoom: 14,
                      center: { lat: (storeLat + deliveryLat) / 2, lng: (storeLng + deliveryLng) / 2 },
                      disableDefaultUI: true,
                      zoomControl: true,
                      gestureHandling: 'greedy'
                    });

                    // Custom Store Marker (Black circular badge SVG)
                    var storeSvg = \`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="18" fill="#000000" stroke="#ffffff" stroke-width="3"/>
                      <path d="M26 12h-2c0-2.76-2.24-5-5-5S14 9.24 14 12h-2c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V14c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3h-6c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z" fill="#ffffff"/>
                    </svg>\`;

                    storeMarker = new google.maps.Marker({
                      position: storePos,
                      map: map,
                      title: "Store Location",
                      icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(storeSvg),
                        anchor: new google.maps.Point(20, 20),
                        scaledSize: new google.maps.Size(40, 40)
                      }
                    });

                    // Custom User Delivery Marker (White circular badge SVG with house icon)
                    var userSvg = \`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="18" fill="#ffffff" stroke="#000000" stroke-width="3"/>
                      <path d="M16 26v-6h4v6h5v-8h3L20 9 9 18h3v8z" fill="#ea580c"/>
                    </svg>\`;

                    userMarker = new google.maps.Marker({
                      position: deliveryPos,
                      map: map,
                      title: "Customer Delivery Location",
                      icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(userSvg),
                        anchor: new google.maps.Point(20, 20),
                        scaledSize: new google.maps.Size(40, 40)
                      }
                    });

                    // Dashed polyline connecting Store and Delivery Location
                    var lineSymbol = {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      scale: 3
                    };

                    routeLine = new google.maps.Polyline({
                      path: [storePos, deliveryPos],
                      geodesic: true,
                      strokeColor: '#2563eb',
                      strokeOpacity: 0,
                      strokeWeight: 4,
                      icons: [{
                        icon: lineSymbol,
                        offset: '0',
                        repeat: '15px'
                      }],
                      map: map
                    });

                    // Auto-fit map bounds to show both pins cleanly
                    var bounds = new google.maps.LatLngBounds();
                    bounds.extend(storePos);
                    bounds.extend(deliveryPos);
                    map.fitBounds(bounds, 50);

                    // Moving partner marker if live tracking enabled
                    if (isLiveTracking) {
                      var riderSvg = \`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="18" fill="#10b981" stroke="#ffffff" stroke-width="3"/>
                        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="18">🏍️</text>
                      </svg>\`;

                      riderMarker = new google.maps.Marker({
                        position: storePos,
                        map: map,
                        title: "Live Partner Location",
                        icon: {
                          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(riderSvg),
                          anchor: new google.maps.Point(20, 20),
                          scaledSize: new google.maps.Size(40, 40)
                        }
                      });
                    }
                  }

                  function handleMessage(event) {
                    try {
                      var data = JSON.parse(event.data);
                      if (data && data.type === 'UPDATE_LOCATION' && riderMarker) {
                        var newPos = { lat: data.lat, lng: data.lng };
                        riderMarker.setPosition(newPos);
                        routeLine.setPath([newPos, { lat: deliveryLat, lng: deliveryLng }]);
                        var bounds = new google.maps.LatLngBounds();
                        bounds.extend(newPos);
                        bounds.extend({ lat: deliveryLat, lng: deliveryLng });
                        map.fitBounds(bounds, 50);
                      }
                    } catch(e) {}
                  }
                  window.addEventListener('message', handleMessage);
                  document.addEventListener('message', handleMessage);

                  window.onload = initMap;
                </script>
              </body>
              </html>
            `
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          style={StyleSheet.absoluteFill}
          onLoadEnd={() => setIsMapLoaded(true)}
        />

        {/* Map Loading Overlay (Scoped strictly to map area) */}
        {(!isMapLoaded || partnerCoords === null) && (
          <View style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: isDarkMode ? '#111827' : '#f1f5f9',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99,
          }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>📍</Text>
            <ActivityIndicator size="large" color={colors.accent} style={{ marginBottom: 8 }} />
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: colors.textPrimary }}>
              {partnerCoords === null ? 'Getting live GPS location...' : 'Loading Map...'}
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
              {partnerCoords === null ? 'Connecting GPS' : 'Plotting customer & store pins'}
            </Text>
          </View>
        )}

        {/* Floating status pill */}
        <View style={[
          styles.floatingIndicator,
          { backgroundColor: stage === 'arrived' ? '#10b981' : colors.accent },
        ]}>
          <Text style={styles.indicatorText}>
            {stage === 'arrived' ? '📍 Arrived at Customer' : 'Arriving in 4 mins'}
          </Text>
          <Text style={[styles.indicatorSub, { color: isDarkMode ? '#ffffff' : '#a7f3d0' }]}>
            {stage === 'arrived' ? shortDeliveryAddress : calculateHaversineDistance(storeLat, storeLng, deliveryLat, deliveryLng)}
          </Text>
        </View>
      </View>

      {/* Bottom Route Detail Sheet */}
      <View style={[styles.detailSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

        {/* Order Details & Customer Info Footer Container */}
        <View style={{ 
          backgroundColor: isDarkMode ? '#131824' : '#ffffff', 
          borderColor: isDarkMode ? '#222d41' : '#e2e8f0', 
          borderWidth: 1.5,
          padding: 16, 
          borderRadius: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDarkMode ? 0.25 : 0.08,
          shadowRadius: 12,
          elevation: 4,
          marginHorizontal: 16,
          marginVertical: 12,
        }}>
          {/* Top Row: Order context & Badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
              <Text style={[styles.orderNumber, { color: colors.textPrimary, fontFamily: 'Inter-Bold', fontSize: 14, letterSpacing: 0.2, marginBottom: 0 }]}>
                Order #{customOrderId}
              </Text>
              <View style={{ backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ color: '#d97706', fontFamily: 'Inter-Bold', fontSize: 10, letterSpacing: 0.5 }}>CUSTOMER</Text>
              </View>
            </View>
            <View style={[
              styles.transitBadge,
              { backgroundColor: stage === 'arrived' ? '#d1fae5' : colors.accentLight, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
            ]}>
              <Text style={[styles.transitText, { color: colors.accent, fontSize: 10, fontFamily: 'Inter-Bold' }]}>
                {stage === 'arrived' ? 'ARRIVED' : 'IN TRANSIT'}
              </Text>
            </View>
          </View>

          {/* Separator line */}
          <View style={{ height: 1.5, backgroundColor: isDarkMode ? '#222d41' : '#e2e8f0', marginBottom: 12 }} />

          {/* Bottom Row: Customer info & Call action */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{ color: colors.textPrimary, fontFamily: 'Inter-Bold', fontSize: 16, marginBottom: 4, letterSpacing: -0.1 }}>
                {jobDetails?.user_name || 'Sarah J.'}
              </Text>
              {(() => {
                const { line1, line2 } = getSplitAddress(cleanDeliveryAddress);
                return (
                  <View style={{ gap: 3, marginTop: 3 }}>
                    <Text style={{ color: colors.textSecondary, fontFamily: 'Inter-Medium', fontSize: 12.5, lineHeight: 18 }}>
                      {line1}
                    </Text>
                    {line2 ? (
                      <Text style={{ color: colors.textSecondary, fontFamily: 'Inter-Medium', fontSize: 12.5, lineHeight: 18 }}>
                        {line2}
                      </Text>
                    ) : null}
                  </View>
                );
              })()}
            </View>
            <Pressable 
              onPress={() => {
                const phoneRegex = /(?:Contact(?:\s*No)?|Phone|Mobile|Mob|Tel|Ph)[:\s-]*(\+?\d[\d\s-]{8,14}\d)/i;
                const phoneMatch = (jobDetails?.delivery_address || '').match(phoneRegex);
                const rawPhone = (phoneMatch ? phoneMatch[1] : '') || jobDetails?.user_phone || jobDetails?.phone || '';
                const userPhone = rawPhone ? rawPhone.replace(/[-\s]/g, '') : '';
                if (userPhone) {
                  Linking.openURL('tel:' + userPhone);
                } else {
                  Alert.alert('Phone Number Not Available', 'Customer contact number is not provided for this order.');
                }
              }}
              style={[styles.navCallBtn, { 
                backgroundColor: '#10b981', 
                width: 44, 
                height: 44, 
                borderRadius: 22,
                shadowColor: '#10b981',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 3,
                alignItems: 'center',
                justifyContent: 'center',
              }]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                  fill="#ffffff"
                />
              </Svg>
            </Pressable>
          </View>
        </View>

        {/* ── STAGE: IN TRANSIT ── */}
        {stage === 'in_transit' && (
          <View style={styles.actionsContainer}>
            <SwipeButton
              text="Swipe to Arrive at Customer"
              color="#f59e0b"
              onSwipeSuccess={handleArrivedAtCustomer}
              containerStyle={styles.mapSwipeBtn}
            />
            <Pressable
              onPress={() => setShowCancelModal(true)}
              style={[styles.cancelBtnFull, { borderColor: '#ef4444' }]}
            >
              <Text style={styles.cancelBtnFullText}>Cancel Delivery</Text>
            </Pressable>
          </View>
        )}

        {/* ── STAGE: ARRIVED ── */}
        {stage === 'arrived' && (
          <View style={styles.actionsContainer}>
            <SwipeButton
              text="Swipe to Complete Delivery"
              color="#10b981"
              onSwipeSuccess={handleComplete}
              containerStyle={styles.mapSwipeBtn}
            />
            <Pressable
              onPress={() => setShowCancelModal(true)}
              style={[styles.cancelBtnFull, { borderColor: '#ef4444' }]}
            >
              <Text style={styles.cancelBtnFullText}>Cancel Delivery</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── CANCEL MODAL ── */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCancelModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            {/* Handle */}
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

            {/* Title */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cancel Delivery</Text>
              <Pressable onPress={() => setShowCancelModal(false)} hitSlop={12}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Select a reason for cancellation
            </Text>

            {/* Reason list */}
            <ScrollView style={styles.reasonList} showsVerticalScrollIndicator={false}>
              {CANCEL_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  onPress={() => setSelectedReason(reason)}
                  style={[
                    styles.reasonItem,
                    {
                      borderColor: selectedReason === reason ? colors.accent : colors.border,
                      backgroundColor: selectedReason === reason ? colors.accentLight : colors.iconBg,
                    },
                  ]}
                >
                  <View style={[
                    styles.radioOuter,
                    { borderColor: selectedReason === reason ? colors.accent : colors.border },
                  ]}>
                    {selectedReason === reason && (
                      <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />
                    )}
                  </View>
                  <Text style={[
                    styles.reasonText,
                    { color: selectedReason === reason ? colors.textPrimary : colors.textSecondary },
                  ]}>
                    {reason}
                  </Text>
                </Pressable>
              ))}

              {/* Notes input */}
              <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>Additional Notes (optional)</Text>
              <CustomInput
                value={cancelNotes}
                onChangeText={setCancelNotes}
                placeholder="Describe the issue..."
                multiline
                numberOfLines={3}
                style={styles.notesInput}
              />

              {/* Submit */}
              <CustomButton
                title="Submit Cancellation"
                variant="primary"
                onPress={handleCancelSubmit}
                disabled={!selectedReason}
                style={[
                  styles.submitCancelBtn,
                  { backgroundColor: selectedReason ? '#ef4444' : colors.border },
                ]}
              />
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 18 },
  headerPlaceholder: { width: 40 },
  mapContainer: { flex: 1, position: 'relative', overflow: 'hidden' },
  floatingIndicator: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  indicatorText: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#ffffff' },
  indicatorSub: { fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 },
  detailSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 12 },
    }),
  },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  orderNumber: { fontFamily: 'Inter-Bold', fontSize: 18 },
  transitBadge: { borderRadius: 9999, paddingVertical: 4, paddingHorizontal: 12 },
  transitText: { fontFamily: 'Inter-SemiBold', fontSize: 12, letterSpacing: 0.6 },
  addressSection: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 20 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickupDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pickupDotInner: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#10b981' },
  dropoffDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  addressContent: { flex: 1 },
  addressLabel: { fontFamily: 'Inter-SemiBold', fontSize: 10, letterSpacing: 0.6, marginBottom: 2 },
  addressTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14 },
  addressSeparator: { height: 1, marginVertical: 12, marginLeft: 24 },
  actionsContainer: {
    width: '100%',
  },
  mapSwipeBtn: {
    width: '100%',
    marginBottom: 8,
  },
  cancelBtnFull: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    width: '100%',
    backgroundColor: 'transparent',
  },
  cancelBtnFullText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#ef4444',
  },
  cancelBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#ef4444',
  },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontFamily: 'Inter-Bold', fontSize: 20 },
  modalSubtitle: { fontFamily: 'Inter-Regular', fontSize: 13, marginBottom: 18 },
  reasonList: { maxHeight: 520 },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { fontFamily: 'Inter-Medium', fontSize: 14, flex: 1 },
  notesLabel: { fontFamily: 'Inter-SemiBold', fontSize: 13, marginBottom: 8, marginTop: 4 },
  notesInput: { marginBottom: 20, minHeight: 80 },
  submitCancelBtn: { height: 52, borderRadius: 12, marginTop: 4 },
  navDetailsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  navDetailsTextContainer: {
    flex: 1,
  },
  navDetailsLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  navDetailsName: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginBottom: 2,
  },
  navDetailsAddress: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    lineHeight: 18,
  },
  navCallBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});
