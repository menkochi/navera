import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import AppDashboard from "./pages/AppDashboard"
import LoginPage from "./pages/LoginPage"
import ProtectedRoute from "./components/ProtectedRoute"

function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-gray-900">Ask Navera</h1>
        <p className="mt-4 text-lg text-gray-600">
          Speech and language support, organised beautifully.
        </p>
        <a
          href="/login"
          className="inline-block mt-8 bg-indigo-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-indigo-700"
        >
          Log in
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}