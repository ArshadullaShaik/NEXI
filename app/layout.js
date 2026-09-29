import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Placement Copilot — resume matching, roadmaps & real interview experiences',
  description:
    'Match your resume against real company requirements, get a week-by-week skill-gap roadmap, track deadlines, run a mock interview, and read what seniors were actually asked.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Matches the page background, so mobile browser chrome doesn't flash a
  // mismatched bar while the app boots.
  themeColor: '#f8fafc',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:inline-flex focus:items-center focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
