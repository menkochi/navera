import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom"
import SLTApp from "./att_v13_uat"
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
        <Link
          to="/login"
          className="inline-block mt-8 bg-indigo-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-indigo-700"
        >
          Log in
        </Link>
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
              <SLTApp />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}