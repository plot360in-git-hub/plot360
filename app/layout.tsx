import '@/styles/globals.css';

export const metadata = {
  title: 'Plot360',
  description: 'Register, verify, and track your properties.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
