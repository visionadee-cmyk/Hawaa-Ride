# Hawaa Ride — Setup & Deployment Guide

## 1. Prerequisites

- Node.js (LTS recommended)
- npm (comes with Node.js)
- Firebase account (free tier works)
- Expo account (for builds)
- Google Maps API key (for maps on Android/iOS)

## 2. Install Dependencies

```bash
cd hawaa-ride
npm install
```

## 3. Firebase Setup

### 3.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (e.g., `hawa-ride`)
3. Enable **Authentication** → Sign-in method → **Phone**
4. Enable **Firestore Database** (start in test mode for dev)
5. Enable **Realtime Database** (start in test mode for dev)

### 3.2 Get Firebase Config

1. Project settings → General → Your apps → Web app
2. Copy the config object

### 3.3 Add Config to `app.json`

Open `app.json` and fill in `expo.extra.firebase`:

```json
{
  "expo": {
    "extra": {
      "firebase": {
        "apiKey": "YOUR_API_KEY",
        "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
        "projectId": "YOUR_PROJECT_ID",
        "storageBucket": "YOUR_PROJECT_ID.appspot.com",
        "messagingSenderId": "YOUR_SENDER_ID",
        "appId": "YOUR_APP_ID",
        "measurementId": "YOUR_MEASUREMENT_ID"
      }
    }
  }
}
```

### 3.4 Firebase Rules (Development)

**Firestore rules** (start permissive, tighten later):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Realtime Database rules**:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

## 4. Maps Setup

### Android

1. Get a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/)
2. In `app.json`, under `android.config`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_GOOGLE_MAPS_API_KEY"
        }
      }
    }
  }
}
```

### iOS

1. Get the iOS API key (same or separate)
2. In `app.json`, under `ios.config`:

```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_GOOGLE_MAPS_API_KEY"
      }
    }
  }
}
```

## 5. Run Locally

### Start Metro bundler

```bash
npx expo start
```

### Run on Android

```bash
npx expo start --android
```

### Run on iOS (macOS only)

```bash
npx expo start --ios
```

### Run on Web

```bash
npx expo start --web
```

## 6. Test Flows

### Rider Flow
1. Sign in with phone OTP
2. Select **Rider** role
3. Home screen shows map with current location
4. Long-press map to set drop-off
5. Choose vehicle type (Bike/Car/Pickup/Van)
6. Tap **Confirm ride**
7. Track driver in real-time on ride screen

### Driver Flow
1. Sign in with phone OTP
2. Select **Driver** role
3. Register (name, license, vehicle type, details)
4. Wait for admin approval
5. Toggle **online**
6. Accept nearby ride requests
7. Location updates automatically to Firebase

### Admin Flow
1. Sign in with phone OTP
2. Select **Admin** role
3. View pending drivers → Approve/Reject
4. View all rides with details

## 7. Deployment

### 7.1 Expo Build (EAS)

Install EAS CLI:

```bash
npm install -g eas-cli
```

Login:

```bash
eas login
```

Configure project:

```bash
eas build:configure
```

Build for Android:

```bash
eas build --platform android
```

Build for iOS:

```bash
eas build --platform ios
```

### 7.2 Firebase Hosting (optional for web admin)

If you want a web version of the admin dashboard:

```bash
npx expo export --platform web
firebase deploy --only hosting
```

## 8. Database Collections

Created automatically by the app:

- `users` — phone, role
- `drivers` — profile, approval status, online state, location
- `rides` — rider, driver, pickup, dropoff, status, fare
- `drivers/{uid}/location` (Realtime DB) — live GPS updates

## 9. Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot find module` | Run `npm install` |
| Phone auth fails | Enable Phone provider in Firebase Auth |
| Maps show blank | Add valid Google Maps API key |
| Location permission denied | Grant location permission in app settings |
| Firestore permission denied | Update Firestore rules (see section 3.4) |

## 10. Next Steps

- Add push notifications (Expo Notifications + Firebase Cloud Messaging)
- Add online payment integration
- Add document upload for drivers (Firebase Storage)
- Add ratings & reviews
- Add in-app chat between rider and driver
