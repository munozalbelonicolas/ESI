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

  const totalRevenue = orders.filter(o => o.paymentStatus === 'approved').reduce((sum, o) => sum + o.total, 0);
  const totalOrders = orders.length;
  const paidOrders = orders.filter(o => o.paymentStatus === 'approved').length;
  const lowStockProducts = products.filter(p => !p.isDigital && p.stock >= 0 && p.stock <= SITE_CONFIG.lowStockThreshold);

  // Gráfico de ventas por mes
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const salesByMonth = new Array(12).fill(0);
  orders.filter(o => o.paymentStatus === 'approved').forEach(o => {
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
        </div>
      </div>

      <div className="admin-chart">
        <h3>Volumen de ventas mensual</h3>
        <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
      </div>

      {lowStockProducts.length > 0 && (
        <div className="admin-table-wrapper">
          <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--color-border-light)' }}>
            <h3 style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiAlertTriangle /> Alertas de stock
            </h3>
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Precio</th></tr>
            </thead>
            <tbody>
              {lowStockProducts.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.category}</td>
                  <td><span className="badge badge--out">{p.stock} uds</span></td>
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
