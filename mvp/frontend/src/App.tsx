import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { HomePage } from '@/pages/HomePage';
import { CodeExplorer } from '@/pages/CodeExplorer';

export function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="code-explorer-theme">
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/explorer" element={<CodeExplorer />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}