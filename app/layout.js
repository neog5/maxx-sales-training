import "./globals.css";
import EnvironmentBanner, { appEnv, isProduction } from "@/components/EnvironmentBanner";

export const metadata = {
  title: `${isProduction ? "" : `[${appEnv.toUpperCase()}] `}Maxx Orthopedics Sales Training`,
  description: "Maxx Orthopedics sales training and assessment portal",
  ...(isProduction ? {} : { robots: { index: false, follow: false } }),
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <EnvironmentBanner />
        {children}
      </body>
    </html>
  );
}
