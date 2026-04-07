# Device Provisioning Guide

Instructions for building, configuring, and shipping 25 Google Pixel phones running the Mars Agent mobile app.

---

## Pre-Provisioning

### Hardware Checklist

| Item | Specification | Qty |
|------|---------------|-----|
| Google Pixel | 7a or later | 25 |
| USB-C cable | 1m braided, data-capable | 25 |
| USB-C wall charger | 18W+ PD | 25 |
| SIM cards | Data-only eSIM or physical nano-SIM (carrier TBD) | 25 (if needed) |
| MicroSD adapter | For initial sideload if ADB unavailable | 2 |
| Provisioning laptop | macOS or Linux with ADB installed | 1 |

### Software Requirements

- Android 14 or later (factory image flashed if device ships with older OS)
- Google Play Services up to date
- Developer Options enabled on every device
- USB Debugging authorized for the provisioning laptop
- ADB (Android Debug Bridge) v34+ installed on provisioning machine

### Account Setup

Create one Google Workspace managed account per device using the naming convention:

```
mars-device-001@yourdomain.com
mars-device-002@yourdomain.com
...
mars-device-025@yourdomain.com
```

Each account should belong to the "Mars Devices" organizational unit in Google Admin Console with the following policies:

- No personal Google account sign-in allowed
- Play Store restricted to approved apps only
- Auto-update over Wi-Fi enabled
- Factory reset protection tied to admin account

---

## APK Build and Deploy

### Build the APK

From the repo root:

```bash
cd apps/mobile
eas build --platform android --profile preview
```

This produces a signed APK via Expo Application Services. The build artifact downloads to `./build/mars-agent.apk`.

For a local build (if EAS is unavailable):

```bash
cd apps/mobile
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

The APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

### Deploy via ADB (Sideload)

Connect each device via USB and run:

```bash
adb devices                          # Verify device is listed
adb install -r mars-agent.apk       # Install or update
adb shell am start -n com.mars.agent/.MainActivity   # Launch to verify
```

### Deploy via EAS Update (OTA)

After the initial sideload, subsequent updates can be pushed over the air:

```bash
cd apps/mobile
eas update --branch production --message "v1.x.x release notes"
```

Devices will pick up the update on next app launch or background check (configurable interval, default 4 hours).

---

## Device Configuration

### Step 1: Enable Developer Options

1. Open **Settings > About phone**
2. Tap **Build number** 7 times
3. Go back to **Settings > System > Developer options**
4. Enable **USB debugging**
5. Enable **Stay awake** (while charging)

### Step 2: Install the APK

```bash
adb install -r mars-agent.apk
```

Verify the app launches and reaches the login screen.

### Step 3: Configure Device Owner Mode

For full kiosk and MDM control, set the Mars Agent app as device owner before any Google account is added to the device:

```bash
adb shell dpm set-device-owner com.mars.agent/.AdminReceiver
```

This grants the app permission to:

- Lock the device to single-app (kiosk) mode
- Control which apps can be installed
- Manage Wi-Fi and network settings
- Enforce password policies

### Step 4: Enroll in Esper MDM

1. Open the Esper Agent sideloaded alongside Mars Agent
2. Enter the enrollment code from the Esper Console (unique per device)
3. Wait for provisioning profile to apply (1-2 minutes)
4. Verify device appears in Esper Console under "Mars Fleet" group

Esper MDM provides:

- Remote app install and update
- Remote lock and wipe
- Kiosk mode enforcement
- Device location tracking
- Compliance policy enforcement

### Step 5: Lock to Mars Agent (Kiosk Mode)

Via Esper Console:

1. Navigate to **Device Groups > Mars Fleet > Compliance Policy**
2. Set **Kiosk Mode** to enabled
3. Select **Mars Agent** as the pinned application
4. Disable navigation bar, status bar pull-down, and notification shade
5. Allow only the following background services: FCM, Esper Agent, Wi-Fi

Alternatively, via ADB for testing:

```bash
adb shell am start -n com.mars.agent/.MainActivity
adb shell settings put global device_provisioned 1
```

### Step 6: Configure Push Notifications (FCM)

The Mars Agent app is pre-configured with Firebase Cloud Messaging. Ensure:

- The `google-services.json` is bundled in the APK (handled at build time)
- Each device's FCM token is registered with the backend on first login
- The backend stores tokens in the `device_tokens` table in Supabase

Test push delivery:

```bash
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=$FCM_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "<device-fcm-token>",
    "notification": {
      "title": "Mars Agent",
      "body": "Provisioning test notification"
    }
  }'
```

### Step 7: Set Auto-Update Policy

Via Esper Console, configure the Mars Fleet group:

- **App update policy**: Auto-update when connected to Wi-Fi
- **OS update policy**: Auto-install security patches, defer feature updates by 30 days
- **Update window**: 2:00 AM - 5:00 AM local time (to avoid disrupting trading hours)

---

## Per-Device Setup Checklist

| Device # | Serial Number | Google Account | Client Name | APK Version | MDM Enrolled | Kiosk Locked | FCM Verified | Ship Date |
|----------|---------------|----------------|-------------|-------------|--------------|--------------|--------------|-----------|
| 001 | | mars-device-001@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 002 | | mars-device-002@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 003 | | mars-device-003@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 004 | | mars-device-004@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 005 | | mars-device-005@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 006 | | mars-device-006@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 007 | | mars-device-007@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 008 | | mars-device-008@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 009 | | mars-device-009@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 010 | | mars-device-010@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 011 | | mars-device-011@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 012 | | mars-device-012@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 013 | | mars-device-013@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 014 | | mars-device-014@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 015 | | mars-device-015@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 016 | | mars-device-016@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 017 | | mars-device-017@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 018 | | mars-device-018@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 019 | | mars-device-019@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 020 | | mars-device-020@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 021 | | mars-device-021@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 022 | | mars-device-022@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 023 | | mars-device-023@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 024 | | mars-device-024@yourdomain.com | | | [ ] | [ ] | [ ] | |
| 025 | | mars-device-025@yourdomain.com | | | [ ] | [ ] | [ ] | |

---

## Security

### Screen Lock

- Minimum 6-digit PIN required on all devices
- Biometric unlock (fingerprint) enabled as a convenience method
- PIN is the fallback; biometric alone cannot be the sole authentication
- Auto-lock after 2 minutes of inactivity
- Maximum 5 failed PIN attempts before device wipe

### Biometric Authentication

- Fingerprint enrollment is done during client onboarding
- The Mars Agent app uses Android BiometricPrompt API for trade confirmations
- Biometric data never leaves the device (stored in Titan M2 security chip on Pixel)

### Remote Wipe

- Available via Esper MDM Console under **Device Actions > Factory Reset**
- Can also be triggered via Esper API:

```bash
curl -X POST "https://api.esper.io/api/enterprise/$ESPER_ENTERPRISE_ID/device/<device-id>/command/" \
  -H "Authorization: Bearer $ESPER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command_type": "WIPE", "command_args": {}}'
```

- All client data is encrypted at rest using Android file-based encryption (FBE)
- Remote wipe destroys the encryption keys, making data unrecoverable

### Data Encryption

- Android file-based encryption (FBE) enabled by default on Pixel 7a+
- All API traffic uses TLS 1.3 (certificate pinning configured in the app)
- Local SQLite cache (if any) is encrypted with SQLCipher
- No sensitive data stored in SharedPreferences; all secrets in Android Keystore

### Network Security

- All backend communication over HTTPS with TLS 1.3
- Certificate pinning for the Mars API backend domain
- No HTTP fallback allowed (network security config enforces this)
- VPN configuration available via MDM if clients require it

---

## Shipping

### Package Contents

Each shipment box contains:

1. Google Pixel phone (pre-configured, powered off)
2. USB-C charging cable (1m)
3. USB-C wall charger (18W+)
4. Quick-start card (laminated, double-sided)
5. Credentials envelope (sealed, contains PIN and login details)
6. Return label (pre-paid, for device returns or replacements)

### Quick-Start Card

**Side 1 — Getting Started**

```
Welcome to Mars Agent

1. Power on your Pixel by holding the side button for 3 seconds
2. Connect to Wi-Fi when prompted
3. The Mars Agent app will launch automatically
4. Open the sealed envelope for your PIN and login credentials
5. Log in with your email and the temporary password provided

Need help? support@marsagent.com | +1 (555) 123-4567
```

**Side 2 — Daily Use**

```
Trading Dashboard — View your portfolio and active positions
Notifications — Real-time alerts for trades, risk events, and reports
Settings — Update password, manage notifications, contact support

Keep your device charged overnight for uninterrupted monitoring.
Updates install automatically between 2-5 AM.

Emergency: To immediately pause all trading, tap the red HALT
button on the dashboard, or call our 24/7 line.
```

### Support Contact Information

| Channel | Details | Availability |
|---------|---------|--------------|
| Email | support@marsagent.com | 24h response time |
| Phone | +1 (555) 123-4567 | 24/7 for P0 emergencies |
| In-App | Settings > Support > Chat | Business hours (9 AM - 6 PM ET) |
| Esper MDM | Remote diagnostics | Admin-initiated |

### Shipping Logistics

- Ship via FedEx Overnight or equivalent tracked carrier
- Require signature on delivery
- Insurance value: replacement cost of device + setup labor
- Include customs declaration for international shipments (HS code 8517.12 for mobile phones)
- Retain tracking numbers in the `shipments` table in Supabase
