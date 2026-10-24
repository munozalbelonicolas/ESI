import { useState, useEffect } from 'react';
import { getMPSettings, saveMPSettings, type MPSettings, DEFAULT_MP_SETTINGS } from '../../services/mpService';
import { FiCreditCard, FiSave, FiInfo, FiKey } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminMercadoPagoPage() {
  const [settings, setSettings] = useState<MPSettings>(DEFAULT_MP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMPSettings()
      .then(setSettings)
      .catch((err) => {
        console.error('[AdminMercadoPago] Error cargando configuración:', err);
        toast.error('No se pudo cargar la configuración de Mercado Pago');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveMPSettings(settings);
      toast.success('Configuración de Mercado Pago guardada');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar la configuración de Mercado Pago');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="admin-mp-page">
      <div className="admin-header">
        <div>
          <h1>Configuración de Mercado Pago</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Opciones del checkout con Tarjeta de Crédito, Débito y Mercado Pago.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        <div className="admin-card" style={{ background: 'var(--color-bg)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-lg)' }}>
            <FiCreditCard style={{ color: 'var(--color-primary)' }} /> Opciones de pago
          </h3>

          <form onSubmit={handleSave}>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" htmlFor="mp-installments" style={{ fontWeight: 600 }}>Máximo de cuotas permitidas</label>
              <select
                id="mp-installments"
                className="form-select"
                value={settings.maxInstallments}
                onChange={(e) => setSettings({ ...settings, maxInstallments: Number(e.target.value) })}
              >
                <option value={1}>1 Cuota (Sin financiación)</option>
                <option value={3}>Hasta 3 Cuotas</option>
                <option value={6}>Hasta 6 Cuotas</option>
                <option value={12}>Hasta 12 Cuotas</option>
              </select>
            </div>

            <button type="submit" className="btn btn--primary btn--full" disabled={saving}>
              <FiSave /> {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </form>
        </div>

        <div className="admin-card" style={{ background: 'var(--color-bg-alt)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-md)' }}>
            <FiKey /> ¿Dónde van las credenciales?
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: 12 }}>
            Por seguridad, las credenciales no se cargan en este panel. Se configuran como variables de entorno del proyecto en Vercel:
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 'var(--text-xs)', display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.5 }}>
            <li><code>MP_ACCESS_TOKEN</code>: Access Token de producción (Mercado Pago → Tus integraciones → Credenciales de producción).</li>
            <li><code>MP_WEBHOOK_SECRET</code>: clave secreta de Webhooks (Tus integraciones → Webhooks).</li>
          </ul>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 'var(--text-xs)', display: 'flex', gap: 8 }}>
            <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>El modo (pruebas o producción) lo define el Access Token: los de producción empiezan con <code>APP_USR-</code>. Después de cambiar una variable hay que volver a desplegar.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
