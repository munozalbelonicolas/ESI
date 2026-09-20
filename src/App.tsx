import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import WhatsAppButton from './components/layout/WhatsAppButton';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Landing page loaded eagerly for maximum LCP / FCP performance
import HomePage from './pages/HomePage';

// Public pages (lazy loaded)
const ShopPage = lazy(() => import('./pages/ShopPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const CheckoutSuccessPage = lazy(() => import('./pages/CheckoutSuccessPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Admin pages & layout (lazy loaded to prevent bloated visitor bundle)
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'));
const AdminBlogPage = lazy(() => import('./pages/admin/AdminBlogPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminCouponsPage = lazy(() => import('./pages/admin/AdminCouponsPage'));
const AdminShippingPage = lazy(() => import('./pages/admin/AdminShippingPage'));
const AdminBankPage = lazy(() => import('./pages/admin/AdminBankPage'));
const AdminMercadoPagoPage = lazy(() => import('./pages/admin/AdminMercadoPagoPage'));

function RouteLoadingFallback() {
  return (
    <div className="page-loader" role="status" aria-label="Cargando contenido">
      <div className="spinner" />
    </div>
  );
}

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
          <Suspense fallback={<RouteLoadingFallback />}>
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
                <Route path="banco" element={<AdminBankPage />} />
                <Route path="mercadopago" element={<AdminMercadoPagoPage />} />
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
          </Suspense>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
