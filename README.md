# Pixel Key

An Android tool that turns your own Google account sign-in into a backup profile, all on-device.

## Features

- **Sign in with Google**: sign in on Google's own page inside the app. Pixel Key exchanges the resulting sign-in token for a long-lived account token on the device.
- **Manual entry**: enter email, master token (`aas_et/...`), Android ID and an optional token binding alias yourself, or paste a captured auth request (form-encoded or JSON) from the clipboard to fill the fields.
- **Device model**: choose which Pixel model the backup identifies as. Pixel and Pixel XL give original quality; Pixel 2 through Pixel 5 give storage saver quality.
- **Output**: the profile is shown as a QR code and as text. You can copy the text and paste it into a compatible backup client.

The UI is in Chinese.

## Privacy & security

- No server. The app talks only to Google (`accounts.google.com` for sign-in, `android.clients.google.com` for the token exchange).
- Credentials are never written to disk or uploaded. They stay in memory and are cleared when you finish, go back, or the app goes to the background. App backup is disabled.
- The sign-in page runs in an incognito WebView; its cookies, cache and storage are wiped after use.
- Screen capture is blocked on sensitive screens (sign-in, manual entry, result).
- Copied profiles are marked sensitive on the clipboard, so Android hides them in clipboard previews.
- Autofill is cancelled when leaving manual entry, so typed secrets are not offered to an autofill service.

## Install

Download the APK from [GitHub Releases](../../releases) and sideload it. Pixel Key is not on Google Play.

## Usage

1. Pick the device model on the home screen (optional).
2. Tap the Google button and sign in, or choose manual entry and fill in the fields.
3. On the result screen, scan the QR code or copy the text. The output is a profile you can import into a compatible backup client.

The profile grants access to your Google account. Only import it on your own devices.

## Build

```sh
npm install
npx expo run:android
```

Run the tests:

```sh
npm test
```

## Disclaimer

Pixel Key is not affiliated with or endorsed by Google. Using it may violate Google's terms of service. Use it only with your own account and at your own risk. The software is provided under the MIT License, without warranty of any kind.

## License

[MIT](LICENSE)
