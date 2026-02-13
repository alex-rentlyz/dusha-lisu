import "./globals.css";

export const metadata = {
  title: "Душа лісу — Менеджмент бронювань",
  description: "Система управління бронюваннями для гостьових будиночків",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
