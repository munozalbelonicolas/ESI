import { useState, useEffect } from 'react';
import { getAllOrders } from '../../services/orderService';
import { getAllProducts } from '../../services/productService';
import { formatPrice } from '../../utils/formatPrice';
import { SITE_CONFIG } from '../../config/site';
import type { Order } from '../../types/order';
import type { Product } from '../../types/product';
import { FiDollarSign, FiShoppingCart, FiPackage, FiAlertTriangle } from 'react-icons/fi';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [o, p] = await Promise.all([getAllOrders(), getAllProducts()]);
      setOrders(o);
      setProducts(p);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  const isPaid = (o: Order) => o.paymentStatus === 'approved' || o.status === 'paid';

  const totalRevenue = orders.filter(isPaid).reduce((sum, o) => sum + o.total, 0);
  const totalOrders = orders.length;
  const paidOrders = orders.filter(isPaid).length;
  const lowStockProducts = products.filter(p => !p.isDigital && p.stock >= 0 && p.stock <= SITE_CONFIG.lowStockThreshold);

  // Gráfico de ventas por mes
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const salesByMonth = new Array(12).fill(0);
  orders.filter(isPaid).forEach(o => {
    const month = o.createdAt?.toDate?.()?.getMonth?.() ?? 0;
    salesByMonth[month] += o.total;
  });

  const chartData = {
    labels: months,
    datasets: [{
      label: 'Ingresos (ARS)',
      data: salesByMonth,
      backgroundColor: 'rgba(107, 45, 123, 0.7)',
      borderColor: 'rgba(107, 45, 123, 1)',
      borderWidth: 1,
      borderRadius: 6,
    }],
  };

  return (
    <div>
      <div className="admin-header">
        <h1>Dashboard</h1>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-card__icon"><FiDollarSign /></div>
          <span className="admin-stat-card__label">Ingresos totales</span>
          <span className="admin-stat-card__value">{formatPrice(totalRevenue)}</span>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__icon"><FiShoppingCart /></div>
          <span className="admin-stat-card__label">Órdenes totales</span>
          <span className="admin-stat-card__value">{totalOrders}</span>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__icon"><FiPackage /></div>
          <span className="admin-stat-card__label">Órdenes pagadas</span>
          <span className="admin-stat-card__value">{paidOrders}</span>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__icon" style={{ color: lowStockProducts.length > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
            <FiAlertTriangle />
          </div>
          <span className="admin-stat-card__label">Productos con poco stock</span>
          <span className="admin-stat-card__value">{lowStockProducts.length}</span>
          {lowStockProducts.length > 0 && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', marginTop: 4 }}>
              ⚠️ Requieren reposición
            </span>
          )}
        </div>
      </div>

      <div className="admin-chart">
        <h3>Volumen de ventas mensual</h3>
        <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
      </div>

      {lowStockProducts.length > 0 && (
        <div className="admin-table-wrapper" style={{ border: '2px solid var(--color-warning-light)', marginTop: 24 }}>
          <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-warning-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-lg)', margin: 0 }}>
              <FiAlertTriangle style={{ color: 'var(--color-warning)' }} /> ⚠️ Productos que requieren reposición urgente (Stock ≤ 5)
            </h3>
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>Producto</th><th>Categoría</th><th>Stock actual</th><th>Precio</th></tr>
            </thead>
            <tbody>
              {lowStockProducts.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700, color: 'var(--color-text)' }}>{p.name}</td>
                  <td>{p.category}</td>
                  <td>
                    <span className="badge badge--out" style={{ fontSize: 'var(--text-sm)', padding: '4px 12px' }}>
                      {p.stock === 0 ? '¡SIN STOCK!' : `Solo ${p.stock} unidad(es)`}
                    </span>
                  </td>
                  <td>{formatPrice(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
