import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './hooks/useTheme'
import { DataProvider } from './hooks/useData'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AssetDetail from './pages/AssetDetail'
import Compare from './pages/Compare'
import About from './pages/About'

function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="asset/:isin" element={<AssetDetail />} />
              <Route path="compare" element={<Compare />} />
              <Route path="about" element={<About />} />
            </Route>
          </Routes>
        </HashRouter>
      </DataProvider>
    </ThemeProvider>
  )
}

export default App
