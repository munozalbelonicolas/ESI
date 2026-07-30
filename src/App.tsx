import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import WhatsAppButton from './components/layout/WhatsAppButton';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';

// Pages
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyOrdersPage from './pages/MyOrdersPage';
import ProfilePage from './pages/ProfilePage';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminBlogPage from './pages/admin/AdminBlogPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminCouponsPage from './pages/admin/AdminCouponsPage';
import AdminShippingPage from './pages/admin/AdminShippingPage';

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: 'calc(100vh - var(--header-height))' }}>{children}</main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                fontFamily: "'Balsamiq Sans', cursive",
                borderRadius: '12px',
                padding: '12px 20px',
              },
            }}
          />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
            <Route path="/tienda" element={<PublicLayout><ShopPage /></PublicLayout>} />
            <Route path="/tienda/:slug" element={<PublicLayout><ProductPage /></PublicLayout>} />
            <Route path="/carrito" element={<PublicLayout><CartPage /></PublicLayout>} />
            <Route path="/checkout" element={<PublicLayout><CheckoutPage /></PublicLayout>} />
            <Route path="/checkout/exito" element={<PublicLayout><CheckoutSuccessPage /></PublicLayout>} />
            <Route path="/blog" element={<PublicLayout><BlogPage /></PublicLayout>} />
            <Route path="/blog/:slug" element={<PublicLayout><BlogPostPage /></PublicLayout>} />
            <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />
            <Route path="/registro" element={<PublicLayout><RegisterPage /></PublicLayout>} />
            <Route path="/mis-ordenes" element={
              <PublicLayout>
                <ProtectedRoute><MyOrdersPage /></ProtectedRoute>
              </PublicLayout>
            } />
            <Route path="/perfil" element={
              <PublicLayout>
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              </PublicLayout>
            } />

            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboardPage />} />
              <Route path="productos" element={<AdminProductsPage />} />
              <Route path="blog" element={<AdminBlogPage />} />
              <Route path="ordenes" element={<AdminOrdersPage />} />
              <Route path="cupones" element={<AdminCouponsPage />} />
              <Route path="envios" element={<AdminShippingPage />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={
              <PublicLayout>
                <div className="section container" style={{ textAlign: 'center', minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <h1 style={{ fontSize: '4rem', color: 'var(--color-primary)' }}>404</h1>
                  <h2>Página no encontrada</h2>
                  <p style={{ color: 'var(--color-text-light)', marginBottom: 24 }}>La página que buscás no existe.</p>
                  <a href="/" className="btn btn--primary">Volver al inicio</a>
                </div>
              </PublicLayout>
            } />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
