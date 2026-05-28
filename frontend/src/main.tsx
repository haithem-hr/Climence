import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './leaflet-polyfill' // This runs first and sets window.L
import 'leaflet.heat' // This will now correctly find window.L

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
