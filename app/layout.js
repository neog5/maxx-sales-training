import "./globals.css";

export const metadata = {
  title: "Maxx Orthopedics Sales Training",
  description: "Maxx Orthopedics sales training and assessment portal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
