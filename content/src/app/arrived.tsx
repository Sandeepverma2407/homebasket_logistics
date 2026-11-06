import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Platform, Dimensions, ScrollView, ActivityIndicator, TextInput, Modal, Pressable, Linking } from 'react-native';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Line, G } from 'react-native-svg';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { decodePolyline } from '../utils/decodePolyline';
import { GOOGLE_MAPS_API_KEY, USE_LIVE_TRACKING_MAP } from '../constants/constant';
import CustomButton from '../components/CustomButton';
import { useTheme } from '../context/ThemeContext';
import SwipeButton from '../components/SwipeButton';
import { useAuth } from '../context/AuthContext';
import CONFIG from '../connection/config';

type OrderItem = { id: string | number; name: string; quantity: number };

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const firebaseConfig = {
  apiKey: "AIzaSyDDJfJ9YMc5vd_GhtIQrpH0ImDwmoo2tVM",
  authDomain: "foodies-f0e7e.firebaseapp.com",
  databaseURL: "https://foodies-f0e7e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "foodies-f0e7e",
  storageBucket: "foodies-f0e7e.appspot.com",
  messagingSenderId: "905071071165",
  appId: "1:905071071165:android:367c2336919aa8ec32ccd4"
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export default function ArrivedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = React.useRef<WebView>(null);

  const { partner } = useAuth();

  const orderId = params.orderId as string || '#FD-8921';
  const jobId = params.jobId as string;
  const restaurantLat = parseFloat(params.restaurantLat as string);
  const restaurantLng = parseFloat(params.restaurantLng as string);
  const userLat = parseFloat(params.userLat as string);
  const userLng = parseFloat(params.userLng as string);

  const [jobDetails, setJobDetails] = useState<any>(null);

  const storeLat = !isNaN(restaurantLat) ? restaurantLat : (jobDetails?.restaurant_latitude ? parseFloat(jobDetails.restaurant_latitude) : 28.6139);
  const storeLng = !isNaN(restaurantLng) ? restaurantLng : (jobDetails?.restaurant_longitude ? parseFloat(jobDetails.restaurant_longitude) : 77.2090);

  const deliveryLat = !isNaN(userLat) ? userLat : (jobDetails?.user_latitude ? parseFloat(jobDetails.user_latitude) : 28.6250);
  const deliveryLng = !isNaN(userLng) ? userLng : (jobDetails?.user_longitude ? parseFloat(jobDetails.user_longitude) : 77.2150);

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
      'Navigate to Destination',
      `Choose a map application to navigate to ${label}:`,
      buttons,
      { cancelable: true }
    );
  };

  const [partnerCoords, setPartnerCoords] = useState<{ latitude: number, longitude: number } | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number, longitude: number }[]>([]);
  const [heading, setHeading] = useState(0);

  const fetchRoute = async (startLat: number, startLng: number) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${storeLat},${storeLng}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.routes && json.routes.length > 0) {
        const points = decodePolyline(json.routes[0].overview_polyline.points);
        setRouteCoords(points);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permissions are required for store navigation.');
        return;
      }

      try {
        const initialLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = initialLoc.coords;
        setPartnerCoords({ latitude, longitude });
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'UPDATE_LOCATION',
          lat: latitude,
          lng: longitude,
        }));
      } catch (e) {
        console.log('[ArrivedScreen] Error fetching initial location:', e);
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (loc) => {
          const { latitude, longitude, heading: locHeading, speed } = loc.coords;
          const currentHeading = locHeading ?? 0;
          setPartnerCoords({ latitude, longitude });
          setHeading(currentHeading);

          webViewRef.current?.postMessage(JSON.stringify({
            type: 'UPDATE_LOCATION',
            lat: latitude,
            lng: longitude,
          }));

          if (USE_LIVE_TRACKING_MAP && partner?.id) {
            try {
              const db = getDatabase(firebaseApp);
              set(ref(db, `/delivery_partners/${partner.id}/location`), {
                lat: latitude,
                lng: longitude,
                heading: currentHeading,
                speed: speed ?? 0,
                updated_at: Date.now(),
              });
            } catch (fbErr) {
              console.error('Firebase DB write error:', fbErr);
            }
          }

          fetchRoute(latitude, longitude);
        }
      );
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [partner?.id]);

  const [hasArrived, setHasArrived] = useState(false);
  const [isPickedUp, setIsPickedUp] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string | number>>(new Set());
  const [loadingItems, setLoadingItems] = useState(true);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const otpRefs = React.useRef<(TextInput | null)[]>([]);

  const handleOtpChange = (val: string, index: number) => {
    const digit = val.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...otp];
    updated[index] = digit;
    setOtp(updated);
    setOtpError(''); // Clear error on change!
    if (digit && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (otp[index] === '' && index > 0) {
        const updated = [...otp];
        updated[index - 1] = '';
        setOtp(updated);
        otpRefs.current[index - 1]?.focus();
      }
    }
  };
  // Fetch real items for this job (on mount and when arrived state changes)
  useEffect(() => {
    console.log('[ArrivedScreen] useEffect triggered with partner_id:', partner?.id, 'jobId:', jobId, 'hasArrived:', hasArrived);
    if (!partner?.id || !jobId) return;
    setLoadingItems(true);
    fetch(CONFIG.ENDPOINTS.GET_DELIVERY_JOBS, {
      method: 'POST',
      headers: CONFIG.HEADERS,
      body: JSON.stringify({ partner_id: partner.id }),
    })
      .then(r => r.json())
      .then(data => {
        console.log('[ArrivedScreen] GET_DELIVERY_JOBS success:', data.success, 'jobs count:', data.jobs?.length);
        if (data.success) {
          const job = data.jobs?.find((j: any) => String(j.id) === String(jobId));
          console.log('[ArrivedScreen] Found job:', job?.id, 'items count:', job?.items?.length);
          if (job) {
            setJobDetails(job);
            if (job.items && job.items.length > 0) {
              setOrderItems(job.items.map((it: any) => ({
                id: String(it.item_id),
                name: it.name,
                quantity: Number(it.quantity),
              })));
            }
          }
        }
      })
      .catch(e => console.error('[ArrivedScreen] Error fetching items:', e))
      .finally(() => setLoadingItems(false));
  }, [partner?.id, jobId, hasArrived]);

  const handleArrivedAtStore = async () => {
    const numericJobId = Number(jobId);
    if (!partner?.id || !Number.isInteger(numericJobId) || numericJobId <= 0) {
      Alert.alert('Error', 'Order details are invalid. Please return to Home and open the order again.');
      return;
    }

    if (jobId && partner?.id) {
      try {
        const response = await fetch(CONFIG.ENDPOINTS.UPDATE_JOB_STATUS, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({
            partner_id: partner.id,
            job_id: numericJobId,
            status: 'AT_STORE'
          })
        });
        const data = await response.json();
        if (!data.success) {
          Alert.alert('Error', data.message || 'Failed to update status.');
        }
      } catch (error) {
        console.error('Error updating status to AT_STORE:', error);
      }
    }
    setHasArrived(true);
  };

  const handleConfirmPickup = async () => {
    const otpValue = otp.join('').trim();
    console.log('[ArrivedScreen] handleConfirmPickup triggered with checkedIds:', Array.from(checkedIds));

    setOtpError('');
    if (jobId && partner?.id) {
      try {
        // Verify the OTP on the server before making any pickup-related changes.
        console.log('[ArrivedScreen] Calling UPDATE_JOB_STATUS with:', {
          partner_id: partner.id,
          job_id: parseInt(jobId, 10),
          status: 'PICKED_UP',
        });
        const statusRes = await fetch(CONFIG.ENDPOINTS.UPDATE_JOB_STATUS, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({
            partner_id: partner.id,
            job_id: parseInt(jobId, 10),
            status: 'PICKED_UP',
            otp_code: otpValue,
          }),
        });
        const statusData = await statusRes.json();
        console.log('[ArrivedScreen] UPDATE_JOB_STATUS response:', statusData);
        if (!statusData.success) {
          setOtpError(statusData.message || 'Failed to verify pickup OTP.');
          setOtp(['', '', '', '']);
          otpRefs.current[0]?.focus();
          return;
        }

        const realDbIds = Array.from(checkedIds).filter(id => !String(id).startsWith('999'));
        if (realDbIds.length > 0) {
          const itemRes = await fetch(CONFIG.ENDPOINTS.UPDATE_ITEM_PICKED, {
            method: 'POST',
            headers: CONFIG.HEADERS,
            body: JSON.stringify({
              partner_id: partner.id,
              job_id: parseInt(jobId, 10),
              item_ids: realDbIds,
            }),
          });
          const itemData = await itemRes.json();
          if (!itemData.success) {
            Alert.alert('Error', itemData.message || 'Failed to mark items as picked.');
            return;
          }
        }

        setShowOtpModal(false);
        setIsPickedUp(true);
      } catch (error) {
        console.error('Error confirming pickup:', error);
        Alert.alert('Error', 'Connection failed. Please try again.');
        return;
      }
    }
  };

  const handleOutForDelivery = async () => {
    console.log('[ArrivedScreen] handleOutForDelivery triggered');
    if (jobId && partner?.id) {
      try {
        console.log('[ArrivedScreen] Calling UPDATE_JOB_STATUS OUT_FOR_DELIVERY with:', {
          partner_id: partner.id,
          job_id: parseInt(jobId, 10),
          status: 'OUT_FOR_DELIVERY',
        });
        const statusRes = await fetch(CONFIG.ENDPOINTS.UPDATE_JOB_STATUS, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({
            partner_id: partner.id,
            job_id: parseInt(jobId, 10),
            status: 'OUT_FOR_DELIVERY',
          }),
        });
        const statusData = await statusRes.json();
        console.log('[ArrivedScreen] UPDATE_JOB_STATUS OUT_FOR_DELIVERY response:', statusData);
        if (!statusData.success) {
          Alert.alert('Error', statusData.message || 'Failed to start delivery.');
          return;
        }
      } catch (error) {
        console.error('Error starting delivery:', error);
        Alert.alert('Error', 'Connection failed. Please try again.');
        return;
      }
    }
    // Navigate to delivery map with coordinates
    router.replace({
      pathname: '/map',
      params: { orderId, jobId, restaurantLat, restaurantLng, userLat, userLng },
    });
  };

  const fallbackItems = [
    { id: '99901', name: 'Fresh Whole Milk (1L)', quantity: 1 },
    { id: '99902', name: 'Organic Bananas (1 Dozen)', quantity: 1 },
    { id: '99903', name: 'Fresh Tomatoes (500g)', quantity: 1 },
  ];

  const itemsToRender = orderItems.length > 0 ? orderItems : fallbackItems;

  const toggleCheckItem = (itemId: string | number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const allChecked = itemsToRender.length > 0 && itemsToRender.every(it => checkedIds.has(it.id));

  // Theme-specific map colors
  const landColor = isDarkMode ? '#111613' : '#f0fdf4';
  const parkColor = isDarkMode ? '#1a2620' : '#d1fae5';
  const waterColor = isDarkMode ? '#1e293b' : '#d0e8ff';
  const roadColor = isDarkMode ? '#222926' : '#ffffff';
  const roadOutlineColor = isDarkMode ? '#333e38' : '#e2e8f0';

  if (loadingItems && !jobDetails) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ marginTop: 16, color: colors.textSecondary, fontFamily: 'Inter-Medium', fontSize: 14 }}>
          Loading navigation details...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header - Top navigation bar */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.iconBg }]} hitSlop={15}>
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Store Navigation</Text>
        <Pressable
          onPress={() => openNavigationAlert(storeLat, storeLng, 'Fresh Supermarket')}
          style={[styles.backButton, { backgroundColor: colors.iconBg }]}
          hitSlop={15}
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

      {/* Map View */}
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
                  var partnerLat = ${partnerCoords?.latitude ?? (storeLat - 0.006)};
                  var partnerLng = ${partnerCoords?.longitude ?? (storeLng - 0.006)};

                  var map, storeMarker, partnerMarker, routeLine;

                  function initMap() {
                    var storePos = { lat: storeLat, lng: storeLng };
                    var partnerPos = { lat: partnerLat, lng: partnerLng };

                    map = new google.maps.Map(document.getElementById('map'), {
                      zoom: 15,
                      center: { lat: (storeLat + partnerLat) / 2, lng: (storeLng + partnerLng) / 2 },
                      disableDefaultUI: true,
                      zoomControl: true,
                      gestureHandling: 'greedy'
                    });

                    // Custom Store Marker (Black circular badge SVG with shop icon)
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

                    // Custom Delivery Partner / Bike-Car Marker (Green circular badge SVG with Bike/Car icon)
                    var riderSvg = \`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="18" fill="#10b981" stroke="#ffffff" stroke-width="3"/>
                      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="18">🏍️</text>
                    </svg>\`;

                    partnerMarker = new google.maps.Marker({
                      position: partnerPos,
                      map: map,
                      title: "Delivery Partner Location",
                      icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(riderSvg),
                        anchor: new google.maps.Point(20, 20),
                        scaledSize: new google.maps.Size(40, 40)
                      }
                    });

                    // Dashed polyline connecting Delivery Partner and Store Location
                    var lineSymbol = {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      scale: 3
                    };

                    routeLine = new google.maps.Polyline({
                      path: [partnerPos, storePos],
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
                    bounds.extend(partnerPos);
                    bounds.extend(storePos);
                    map.fitBounds(bounds, 50);
                  }

                  function handleMessage(event) {
                    try {
                      var data = JSON.parse(event.data);
                      if (data && data.type === 'UPDATE_LOCATION' && partnerMarker) {
                        var newPos = { lat: data.lat, lng: data.lng };
                        partnerMarker.setPosition(newPos);
                        routeLine.setPath([newPos, { lat: storeLat, lng: storeLng }]);
                        var bounds = new google.maps.LatLngBounds();
                        bounds.extend(newPos);
                        bounds.extend({ lat: storeLat, lng: storeLng });
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

        {/* Map Loading Loader Overlay */}
        {(!isMapLoaded || partnerCoords === null) && (
          <View style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: colors.card,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99,
          }}>
            <Text style={{ fontSize: 42, marginBottom: 12 }}>🏍️</Text>
            <ActivityIndicator size="large" color={colors.accent} style={{ marginBottom: 12 }} />
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: colors.textPrimary }}>
              {partnerCoords === null ? 'Getting live GPS location...' : 'Loading Google Map...'}
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              {partnerCoords === null ? 'Connecting partner location' : 'Plotting store & partner location'}
            </Text>
          </View>
        )}

        {/* Floating Distance Badge Overlay (Top Right) */}
        <View style={styles.distanceBadgeOverlay}>
          <View style={styles.distanceArrowCircle}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2L19 21L12 17L5 21L12 2Z"
                fill="#ffffff"
              />
            </Svg>
          </View>
          <Text style={styles.distanceBadgeText}>
            {calculateHaversineDistance(partnerCoords?.latitude ?? (storeLat - 0.006), partnerCoords?.longitude ?? (storeLng - 0.006), storeLat, storeLng)}
          </Text>
        </View>
      </View>

      {/* Bottom Sheet Control Area */}
      <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

        {!hasArrived ? (
          <View style={styles.sheetButtonsContainer}>
            <SwipeButton
              text="Swipe to Arrive at Store"
              color="#3b82f6"
              onSwipeSuccess={handleArrivedAtStore}
              containerStyle={styles.arrivedSwipeBtn}
            />
          </View>
        ) : !isPickedUp ? (
          <View style={styles.pickupVerificationContainer}>
            <Text style={[styles.verificationHeader, { color: colors.textPrimary }]}>Verify Store Pickup Items</Text>
            <Text style={[styles.verificationSubText, { color: colors.textSecondary }]}>Tick each item you've collected from the store</Text>

            {loadingItems ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
            ) : (
              <View style={styles.checkboxList}>
                {itemsToRender.map(item => {
                  const checked = checkedIds.has(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => toggleCheckItem(item.id)}
                      style={[
                        styles.checkboxRow,
                        { backgroundColor: colors.inputBg, borderColor: checked ? colors.accent : colors.border },
                      ]}
                    >
                      <View style={[
                        styles.checkboxCircle,
                        { borderColor: colors.border },
                        checked && { backgroundColor: colors.accent, borderColor: colors.accent },
                      ]}>
                        {checked && (
                          <Svg width={10} height={8} viewBox="0 0 10 8" fill="none">
                            <Path d="M1 4l2.5 2.5L9 1" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[
                          styles.checkboxText,
                          { color: checked ? colors.textSecondary : colors.textPrimary },
                          checked && { textDecorationLine: 'line-through' },
                        ]}>
                          {item.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Qty: {item.quantity}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <SwipeButton
              text="Swipe to Confirm Pickup"
              color="#6366f1"
              onSwipeSuccess={() => setShowOtpModal(true)}
              containerStyle={styles.pickupSwipeBtn}
              disabled={!allChecked}
            />
          </View>
        ) : (
          <View style={styles.sheetButtonsContainer}>
            <Text style={[styles.verificationHeader, { color: colors.textPrimary, marginBottom: 4 }]}>Items Picked Up Successfully</Text>
            <Text style={[styles.verificationSubText, { color: colors.textSecondary, marginBottom: 16 }]}>Ready to deliver? Swipe below to notify customer and navigate.</Text>
            <SwipeButton
              text="Swipe for Out For Delivery"
              color="#10b981"
              onSwipeSuccess={handleOutForDelivery}
              containerStyle={styles.pickupSwipeBtn}
            />
          </View>
        )}

        {/* ── Pickup OTP Verification Slide-Up Modal ── */}
        <Modal
          visible={showOtpModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowOtpModal(false)}
        >
          <View style={styles.modalContainer}>
            <Pressable style={styles.modalOverlay} onPress={() => setShowOtpModal(false)} />
            <View style={[styles.modalContentCard, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Enter Store Pickup OTP</Text>
              <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                Ask store coordinator for the 4-digit verification code.
              </Text>

              {/* OTP Digit Boxes */}
              <View style={styles.pinRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { otpRefs.current[i] = r; }}
                    value={digit}
                    onChangeText={(v) => handleOtpChange(v, i)}
                    onKeyPress={(e) => handleKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    style={[
                      styles.pinBox,
                      {
                        color: colors.textPrimary,
                        borderColor: digit ? colors.accent : colors.border,
                        backgroundColor: colors.inputBg || colors.iconBg,
                      },
                    ]}
                    textAlign="center"
                  />
                ))}
              </View>

              {otpError ? (
                <Text style={styles.errorTextMsg}>{otpError}</Text>
              ) : null}

              {/* Action buttons inside Modal */}
              <View style={styles.modalActions}>
                <CustomButton
                  title="Verify & Confirm Pickup"
                  variant="primary"
                  onPress={handleConfirmPickup}
                  disabled={otp.some(d => d === '')}
                  style={{ height: 50, borderRadius: 14 }}
                />
                <Pressable
                  onPress={() => setShowOtpModal(false)}
                  style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Order Details & Store Info Footer Container */}
        <View style={[styles.orderInfoFooter, { 
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
          marginHorizontal: 4,
          marginBottom: 8,
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }]}>
          {/* Top Row: Order context & Details action */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
              <Text style={[styles.orderIdFooterText, { color: colors.textPrimary, fontFamily: 'Inter-Bold', fontSize: 14, letterSpacing: 0.2 }]}>
                Order #{orderId}
              </Text>
              <View style={{ backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ color: colors.accent, fontFamily: 'Inter-Bold', fontSize: 10, letterSpacing: 0.5 }}>STORE</Text>
              </View>
            </View>
            <Pressable onPress={() => router.back()} style={styles.detailsTextBtn}>
              <Text style={[styles.detailsTextBtnValue, { color: colors.accent, fontFamily: 'Inter-Bold', fontSize: 13, letterSpacing: 0.2 }]}>DETAILS</Text>
            </Pressable>
          </View>

          {/* Separator line */}
          <View style={{ height: 1.5, backgroundColor: isDarkMode ? '#222d41' : '#e2e8f0', marginBottom: 12 }} />

          {/* Bottom Row: Store info & Call action */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{ color: colors.textPrimary, fontFamily: 'Inter-Bold', fontSize: 16, marginBottom: 4, letterSpacing: -0.1 }}>
                {jobDetails?.restaurant_name || 'Fresh Supermarket'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontFamily: 'Inter-Medium', fontSize: 12.5, lineHeight: 18 }}>
                {jobDetails?.restaurant_address || 'Sector 14, Main Market, Delhi'}
              </Text>
            </View>
            <Pressable 
              onPress={() => Linking.openURL('tel:' + (jobDetails?.restaurant_phone || jobDetails?.restaurant_mobile || '9876543210'))}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  headerPlaceholder: {
    width: 36,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  topInstructionCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  topCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nextStopLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  storeNameText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  topCardRight: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  distText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  directionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  directionSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    top: 180,
    gap: 8,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  controlBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  floatingCallBtn: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  bottomSheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetButtonsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
  },
  btnIcon: {
    marginRight: 6,
  },
  disabledButton: {
    backgroundColor: '#ebedeb',
    borderWidth: 1,
    opacity: 0.6,
  },
  pickupVerificationContainer: {
    marginBottom: 16,
  },
  verificationHeader: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginBottom: 4,
  },
  verificationSubText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginBottom: 14,
  },
  checkboxList: {
    gap: 10,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  checkboxCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  arrivedSwipeBtn: {
    width: '100%',
    marginTop: 12,
  },
  pickupSwipeBtn: {
    width: '100%',
    marginTop: 16,
  },
  orderInfoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  footerLeft: {
    gap: 2,
  },
  orderIdFooterText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  itemSummaryFooterText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  detailsTextBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  detailsTextBtnValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },
  otpCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  otpHeaderLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginBottom: 2,
  },
  otpTextInputBox: {
    width: 140,
    height: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    letterSpacing: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContentCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  pinBox: {
    width: 58,
    height: 60,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 26,
    fontFamily: 'Inter-Bold',
  },
  modalActions: {
    gap: 12,
  },
  modalCancelBtn: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
  },
  errorTextMsg: {
    color: '#ef4444',
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
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
  storePinBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#000000',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  userPinBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  distanceBadgeOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 7,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 10,
  },
  distanceArrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 13.5,
    color: '#000000',
  },
});
