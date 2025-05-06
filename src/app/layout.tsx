
import type {Metadata} from 'next';
import { Inter } from 'next/font/google'; // Use standard Inter font from Google Fonts
import './globals.css';
import {Toaster} from '@/components/ui/toaster'; // Import Toaster
import { AuthProvider } from '@/context/AuthContext'; // Import AuthProvider

// Instantiate the Inter font
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' }); // Keep variable name consistent

export const metadata: Metadata = {
  title: 'HallPass - College Hall Booking', // Updated title
  description: 'Register for college hall bookings with director authorization.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Apply the Inter font variable and a fallback */}
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider> {/* Wrap children with AuthProvider */}
           {children}
        </AuthProvider>
        <Toaster /> {/* Add Toaster */}
      </body>
    </html>
  );
}
