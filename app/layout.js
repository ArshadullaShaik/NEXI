import './globals.css';
import { AppProvider } from '@/context/AppContext';
export const metadata = { title: 'Placement Readiness Copilot' };
export default function RootLayout({ children }) {
  return (<html lang="en"><body><AppProvider>{children}</AppProvider></body></html>);
}
