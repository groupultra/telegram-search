# Telegram Search Web

Run `pnpm web:dev` for the server-backed web client, or `pnpm dev` for browser-local Core mode.

## QR code login

On the login page, choose **Log in with QR code**. In the Telegram mobile app, open **Settings → Devices → Link Desktop Device**, scan the code, and confirm. Accounts with two-factor authentication must also enter their password in the web app. Phone-number login remains available.

Codes refresh automatically at Telegram's expiration time. An attempt expires after five minutes; choose **Get a new QR code** to restart. Switching to phone login or leaving the page cancels the attempt. Closing a server-backed connection cancels that connection's pending QR login without logging out an already connected account.

QR images are generated locally in the browser. Login tokens and passwords are not sent to an external QR rendering service or included in bridge logs.
